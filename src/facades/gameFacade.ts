const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
import IPoint from "../interfaces/Point";
import * as mongo from "mongodb";
import { ApiError } from "../errors/apiError";
import UserFacade from "./userFacadeWithDB";
import IPosition from "../interfaces/Position";
import IPost from "../interfaces/Post";
import { positionCreator } from "../utils/geoUtils";
import {
  POSITION_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  USER_COLLECTION_NAME
} from "../config/collectionNames";
let userCollection: mongo.Collection;
let positionsCollection: mongo.Collection;
let postCollection: mongo.Collection;
const EXPIRES_AFTER = 30;

export default class GameFacade {
  static readonly DIST_TO_CENTER = 15;

  static async setDatabase(client: mongo.MongoClient) {
    const dbName = process.env.DB_NAME;
    if (!dbName) {
      throw new Error("Database name not provided");
    }
    //This facade uses the UserFacade, so set it up with the right client
    await UserFacade.setDatabase(client);

    try {
      if (!client.isConnected()) {
        await client.connect();
      }
      // User Collection
      userCollection = client.db(dbName).collection(USER_COLLECTION_NAME);

      // Position Collection
      positionsCollection = client
        .db(dbName)
        .collection(POSITION_COLLECTION_NAME);

      await positionsCollection.createIndex(
        { lastUpdated: 1 },
        { expireAfterSeconds: EXPIRES_AFTER }
      );
      await positionsCollection.createIndex({ location: "2dsphere" });

      // Post Collection
      postCollection = client.db(dbName).collection(POST_COLLECTION_NAME);
      await postCollection.createIndex({ location: "2dsphere" })

      return client.db(dbName);
    } catch (err) {
      console.error("Could not connect", err);
    }
  }

  static async nearbyPlayers(
    userName: string,
    password: string,
    latitude: number,
    longitude: number,
    distance: number
  ) {
    let user;
    try {
      let status = await UserFacade.checkUser(userName, password);
      if (status) {
        user = await UserFacade.getUser(userName);
      }
    } catch (err) {
      throw new ApiError("Wrong username or password", 403);
    }
    try {
      const point = { type: "Point", coordinates: [latitude, longitude] };
      const date = new Date();
      const found = await positionsCollection.findOneAndUpdate(
        { userName },
        {
          $set: {
            userName,
            name: user.name,
            lastUpdated: date,
            location: point
          }
        },
        { upsert: true, returnOriginal: false }
      );
      const nearbyPlayers = await GameFacade.findNearbyPlayers(
        userName,
        point,
        distance
      );
      const formatted = nearbyPlayers.map(player => {
        return {
          userName: player.userName,
          name: player.name,
          lat: latitude,
          lon: longitude
        };
      });
      return formatted;
    } catch (err) {
      throw err;
    }
  }

  static async findNearbyPlayers(
    clientUserName: string,
    point: IPoint,
    distance: number
  ): Promise<Array<IPosition>> {
    try {
      const found = await positionsCollection.find({
        userName: { $ne: clientUserName },
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [point.coordinates[0], point.coordinates[1]]
            },
            $maxDistance: distance
          }
        }
      });
      return found.toArray();
    } catch (err) {
      throw err;
    }
  }

  static async getPostIfReached(
    postId: string,
    lat: number,
    lon: number
  ): Promise<any> {
    try {
      const post: IPost | null = await postCollection.findOne({
        _id: postId,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lat, lon]
            },
            $maxDistance: 10
          }
        }
      });
      if (post === null) {
        throw new ApiError("Post not reached", 400);
      }
      return { postId: post._id, task: post.task.text, isUrl: post.task.isUrl };
    } catch (err) {
      throw err;
    }
  }

  static async addPost(
    name: string,
    taskTxt: string,
    isURL: boolean,
    taskSolution: string,
    lon: number,
    lat: number
  ): Promise<IPost> {
    const position = { type: "Point", coordinates: [lon, lat] };
    const status = await postCollection.insertOne({
      _id: name,
      task: { text: taskTxt, isURL },
      taskSolution,
      location: {
        type: "Point",
        coordinates: [lon, lat]
      }
    });
    const newPost: any = status.ops;
    return newPost as IPost;
  }
}
