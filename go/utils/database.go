package utils

import (
	"context"
	"log"
	"os"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database

func ConnectDB() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found, using system environment variables")
	}

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI environment variable is required")
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "userdb" 
	}

	log.Printf("🔗 Connecting to MongoDB at: %s", hideCredentials(mongoURI))

	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal("❌ Failed to connect to MongoDB:", err)
	}

	err = client.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatal("❌ Failed to ping MongoDB:", err)
	}

	DB = client.Database(dbName)
	log.Printf("✅ Connected to MongoDB! Database: %s", dbName)

	createIndexes()
}

func hideCredentials(uri string) string {
	if len(uri) > 20 {
		return uri[:10] + "***" + uri[len(uri)-10:]
	}
	return "***"
}

func createIndexes() {
	collection := DB.Collection("users")
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	_, err := collection.Indexes().CreateOne(context.TODO(), indexModel)
	if err != nil {
		log.Println("Warning: Could not create unique index on email:", err)
	} else {
		log.Println("✅ Database indexes created successfully")
	}
}

func GetCollection(collectionName string) *mongo.Collection {
	return DB.Collection(collectionName)
}