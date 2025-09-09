package middleware

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
)

var JwtSecret []byte

type JWTCustomClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func InitJWT() {
	godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "fallback-secret-key-for-development-only"
		log.Println("⚠️ Using fallback JWT secret - set JWT_SECRET in production!")
	}

	JwtSecret = []byte(jwtSecret)
	log.Println("✅ JWT configuration loaded successfully")
}

func JWTMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			auth := c.Request().Header.Get("Authorization")
			if auth == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing authorization header")
			}

			if !strings.HasPrefix(auth, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid authorization header format")
			}

			tokenString := auth[7:] // Remove "Bearer " prefix

			token, err := jwt.ParseWithClaims(tokenString, &JWTCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
				return JwtSecret, nil
			})

			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
			}

			if !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
			}

			c.Set("user", token)
			
			return next(c)
		}
	}
}

func GenerateToken(userID, email string) (string, error) {
	claims := &JWTCustomClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JwtSecret)
}