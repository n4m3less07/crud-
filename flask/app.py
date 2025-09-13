# app.py
import os
from datetime import timedelta
from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from dotenv import load_dotenv
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from pymongo.errors import DuplicateKeyError

load_dotenv()  

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/flask_crud")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

mongo = PyMongo(app)
jwt = JWTManager(app)

mongo.db.users.create_index("username", unique=True)

def serialize_doc(doc):
    """Turn ObjectId into str so JSON is serializable."""
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"msg": "username and password required"}), 400

    hashed = generate_password_hash(password)
    user_doc = {"username": username, "password": hashed}
    try:
        res = mongo.db.users.insert_one(user_doc)
    except DuplicateKeyError:
        return jsonify({"msg": "username already exists"}), 409

    user_doc["_id"] = str(res.inserted_id)
    del user_doc["password"]
    return jsonify({"msg": "user created", "user": user_doc}), 201

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"msg": "username and password required"}), 400

    user = mongo.db.users.find_one({"username": username})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"msg": "bad credentials"}), 401

    access_token = create_access_token(identity=str(user["_id"]))
    return jsonify({"access_token": access_token}), 200

@app.route("/items", methods=["GET"])
def list_items():
    docs = mongo.db.items.find()
    items = [serialize_doc(d) for d in docs]
    return jsonify(items), 200

@app.route("/items", methods=["POST"])
@jwt_required()
def create_item():
    current_user = get_jwt_identity()
    data = request.get_json() or {}
    name = data.get("name")
    description = data.get("description", "")
    if not name:
        return jsonify({"msg": "name required"}), 400

    item = {"name": name, "description": description, "owner_id": current_user}
    res = mongo.db.items.insert_one(item)
    item["_id"] = str(res.inserted_id)
    return jsonify(item), 201

@app.route("/items/<item_id>", methods=["GET"])
def get_item(item_id):
    try:
        _id = ObjectId(item_id)
    except Exception:
        return jsonify({"msg": "invalid id"}), 400
    item = mongo.db.items.find_one({"_id": _id})
    if not item:
        return jsonify({"msg": "not found"}), 404
    return jsonify(serialize_doc(item)), 200

@app.route("/items/<item_id>", methods=["PUT"])
@jwt_required()
def update_item(item_id):
    current_user = get_jwt_identity()
    try:
        _id = ObjectId(item_id)
    except Exception:
        return jsonify({"msg": "invalid id"}), 400
    item = mongo.db.items.find_one({"_id": _id})
    if not item:
        return jsonify({"msg": "not found"}), 404
    if item.get("owner_id") != current_user:
        return jsonify({"msg": "forbidden"}), 403

    data = request.get_json() or {}
    update = {}
    if "name" in data:
        update["name"] = data["name"]
    if "description" in data:
        update["description"] = data["description"]

    if not update:
        return jsonify({"msg": "nothing to update"}), 400

    mongo.db.items.update_one({"_id": _id}, {"$set": update})
    item = mongo.db.items.find_one({"_id": _id})
    return jsonify(serialize_doc(item)), 200

@app.route("/items/<item_id>", methods=["DELETE"])
@jwt_required()
def delete_item(item_id):
    current_user = get_jwt_identity()
    try:
        _id = ObjectId(item_id)
    except Exception:
        return jsonify({"msg": "invalid id"}), 400
    item = mongo.db.items.find_one({"_id": _id})
    if not item:
        return jsonify({"msg": "not found"}), 404
    if item.get("owner_id") != current_user:
        return jsonify({"msg": "forbidden"}), 403
    mongo.db.items.delete_one({"_id": _id})
    return jsonify({"msg": "deleted"}), 200

if __name__ == "__main__":
    app.run(debug=True)
