package models


import (
	"time"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	FirstName string             `json:"firstname" bson:"firstname" validate:"required,min=2,max=50"`
	LastName  string             `json:"lastname" bson:"lastname" validate:"required,min=2,max=50"`
	Email     string             `json:"email" bson:"email" validate:"required,email"`
	Password  string             `json:"password,omitempty" bson:"password" validate:"required,min=6"`
	CreatedAt time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time          `json:"updated_at" bson:"updated_at"`
}

type UserResponse struct {
	ID        primitive.ObjectID `json:"id"`
	FirstName string             `json:"firstname"`
	LastName  string             `json:"lastname"`
	Email     string             `json:"email"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UpdateUserRequest struct {
	FirstName string `json:"firstname" validate:"omitempty,min=2,max=50"`
	LastName  string `json:"lastname" validate:"omitempty,min=2,max=50"`
	Email     string `json:"email" validate:"omitempty,email"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}