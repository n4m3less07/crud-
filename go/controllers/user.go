package controllers

import (
	"context"
	"net/http"
	"time"

	"lcrud/middleware"
	"lcrud/models"
	"lcrud/utils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

func RegisterUser(c echo.Context) error {
	user := new(models.User)
	if err := c.Bind(user); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request data")
	}

	if err := c.Validate(user); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Validation failed: "+err.Error())
	}

	collection := utils.GetCollection("users")
	var existingUser models.User
	err := collection.FindOne(context.TODO(), bson.M{"email": user.Email}).Decode(&existingUser)
	if err == nil {
		return echo.NewHTTPError(http.StatusConflict, "User with this email already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to hash password")
	}

	user.Password = string(hashedPassword)
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	result, err := collection.InsertOne(context.TODO(), user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user")
	}

	user.ID = result.InsertedID.(primitive.ObjectID)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "User created successfully",
		"user":    user.ToResponse(),
	})
}

func LoginUser(c echo.Context) error {
	loginReq := new(models.LoginRequest)
	if err := c.Bind(loginReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request data")
	}

	if err := c.Validate(loginReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Validation failed: "+err.Error())
	}

	collection := utils.GetCollection("users")
	var user models.User
	err := collection.FindOne(context.TODO(), bson.M{"email": loginReq.Email}).Decode(&user)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginReq.Password))
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}

	token, err := middleware.GenerateToken(user.ID.Hex(), user.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusOK, models.LoginResponse{
		Token: token,
		User:  user.ToResponse(),
	})
}

func GetAllUsers(c echo.Context) error {
	collection := utils.GetCollection("users")

	cursor, err := collection.Find(context.TODO(), bson.M{})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch users")
	}
	defer cursor.Close(context.TODO())

	var users []models.UserResponse
	for cursor.Next(context.TODO()) {
		var user models.User
		if err := cursor.Decode(&user); err != nil {
			continue
		}
		users = append(users, user.ToResponse())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

func GetUserByID(c echo.Context) error {
	id := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	collection := utils.GetCollection("users")
	var user models.User
	err = collection.FindOne(context.TODO(), bson.M{"_id": objectID}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	return c.JSON(http.StatusOK, user.ToResponse())
}

func UpdateUser(c echo.Context) error {
	id := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	user := c.Get("user").(*jwt.Token)
	claims := user.Claims.(*middleware.JWTCustomClaims)
	currentUserID := claims.UserID

	if currentUserID != id {
		return echo.NewHTTPError(http.StatusForbidden, "You can only update your own profile")
	}

	updateReq := new(models.UpdateUserRequest)
	if err := c.Bind(updateReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request data")
	}

	if err := c.Validate(updateReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Validation failed: "+err.Error())
	}

	updateDoc := bson.M{
		"updated_at": time.Now(),
	}

	if updateReq.FirstName != "" {
		updateDoc["firstname"] = updateReq.FirstName
	}
	if updateReq.LastName != "" {
		updateDoc["lastname"] = updateReq.LastName
	}
	if updateReq.Email != "" {
		collection := utils.GetCollection("users")
		var existingUser models.User
		err := collection.FindOne(context.TODO(), bson.M{
			"email": updateReq.Email,
			"_id":   bson.M{"$ne": objectID},
		}).Decode(&existingUser)
		if err == nil {
			return echo.NewHTTPError(http.StatusConflict, "Email already in use")
		}
		updateDoc["email"] = updateReq.Email
	}

	collection := utils.GetCollection("users")
	result, err := collection.UpdateOne(
		context.TODO(),
		bson.M{"_id": objectID},
		bson.M{"$set": updateDoc},
	)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update user")
	}

	if result.MatchedCount == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	var updatedUser models.User
	err = collection.FindOne(context.TODO(), bson.M{"_id": objectID}).Decode(&updatedUser)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch updated user")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "User updated successfully",
		"user":    updatedUser.ToResponse(),
	})
}

func DeleteUser(c echo.Context) error {
	id := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	user := c.Get("user").(*jwt.Token)
	claims := user.Claims.(*middleware.JWTCustomClaims)
	currentUserID := claims.UserID

	if currentUserID != id {
		return echo.NewHTTPError(http.StatusForbidden, "You can only delete your own profile")
	}

	collection := utils.GetCollection("users")
	result, err := collection.DeleteOne(context.TODO(), bson.M{"_id": objectID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete user")
	}

	if result.DeletedCount == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "User deleted successfully",
	})
}

func GetProfile(c echo.Context) error {
	user := c.Get("user").(*jwt.Token)
	claims := user.Claims.(*middleware.JWTCustomClaims)
	userID := claims.UserID

	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	collection := utils.GetCollection("users")
	var userData models.User
	err = collection.FindOne(context.TODO(), bson.M{"_id": objectID}).Decode(&userData)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	return c.JSON(http.StatusOK, userData.ToResponse())
}