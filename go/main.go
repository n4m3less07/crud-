package main

import (
	"log"
	"os"

	"lcrud/controllers"
	"lcrud/middleware"
	"lcrud/utils"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️  Warning: No .env file found, using system environment variables")
	}

	middleware.InitJWT()

	e := echo.New()

	e.Validator = &CustomValidator{validator: validator.New()}

	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	utils.ConnectDB()

	setupRoutes(e)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s...", port)
	log.Printf("🌍 Environment: %s", getEnv())
	log.Fatal(e.Start(":" + port))
}

func setupRoutes(e *echo.Echo) {
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{
			"status":      "healthy",
			"service":     "lcrud-api",
			"environment": getEnv(),
		})
	})

	api := e.Group("/api")

	api.POST("/register", controllers.RegisterUser)
	api.POST("/login", controllers.LoginUser)

	protected := api.Group("")
	protected.Use(middleware.JWTMiddleware())

	protected.GET("/users", controllers.GetAllUsers)
	protected.GET("/users/:id", controllers.GetUserByID)
	protected.PUT("/users/:id", controllers.UpdateUser)
	protected.DELETE("/users/:id", controllers.DeleteUser)
	protected.GET("/profile", controllers.GetProfile)

	log.Println("✅ Routes configured successfully")
}

func getEnv() string {
	env := os.Getenv("ENV")
	if env == "" {
		return "development"
	}
	return env
}