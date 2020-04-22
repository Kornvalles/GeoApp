import * as mongo from "mongodb";
//const MongoClient = mongo.MongoClient;
import setup from "../src/config/setupDB";
import UserFacade from "../src/facades/userFacadeWithDB";
import GameFacade from "../src/facades/gameFacade";
import { expect } from "chai";
import { bryptAsync } from "../src/utils/bcrypt-async-helper";
import {
  positionCreator,
  getLatitudeOutside,
  getLatitudeInside
} from "../src/utils/geoUtils";
import {
  USER_COLLECTION_NAME,
  POSITION_COLLECTION_NAME,
  POST_COLLECTION_NAME
} from "../src/config/collectionNames";
import { ApiError } from "../src/errors/apiError";

let usersCollection: mongo.Collection | null;
let positionsCollection: mongo.Collection | null;
let postsCollection: mongo.Collection | null;

let client: mongo.MongoClient;
const DISTANCE_TO_SEARCH = 10;

describe("Verify the GameFacade", () => {
  before(async () => {
    client = await setup();
    process.env["DB_NAME"] = "semester_case_test";
    const db = await GameFacade.setDatabase(client);

    if (!db) {
      throw new Error("Database not intialized");
    }
    usersCollection = db.collection(USER_COLLECTION_NAME);
    positionsCollection = db.collection(POSITION_COLLECTION_NAME);
    postsCollection = db.collection(POST_COLLECTION_NAME);

    if (usersCollection === null || positionsCollection === null) {
      throw new Error("user and/or location- collection not initialized");
    }
  });
  after(async () => {
    await client.close();
  });
  beforeEach(async () => {
    if (
      usersCollection === null ||
      positionsCollection === null ||
      postsCollection === null
    ) {
      throw new Error("One of requried collections is null");
    }

    // User Collection
    await usersCollection.deleteMany({});
    const secretHashed = await bryptAsync("secret");
    const team1 = {
      name: "Team1",
      userName: "t1",
      password: secretHashed,
      role: "team"
    };
    const team2 = {
      name: "Team2",
      userName: "t2",
      password: secretHashed,
      role: "team"
    };
    const team3 = {
      name: "Team3",
      userName: "t3",
      password: secretHashed,
      role: "team"
    };
    await usersCollection.insertMany([team1, team2, team3]);

    // Positions Collection
    await positionsCollection.deleteMany({});
    await positionsCollection.createIndex(
      { lastUpdated: 1 },
      { expireAfterSeconds: 30 }
    );
    await positionsCollection.createIndex({ location: "2dsphere" });
    const positions = [
      positionCreator(12.48, 55.77, team1.userName, team1.name, true),
      positionCreator(
        12.48,
        getLatitudeInside(55.77, DISTANCE_TO_SEARCH),
        team2.userName,
        team2.name,
        true
      ),
      positionCreator(
        12.48,
        getLatitudeOutside(55.77, DISTANCE_TO_SEARCH),
        team3.userName,
        team3.name,
        true
      )
    ];
    await positionsCollection.insertMany(positions);

    // Post Collection
    await postsCollection.deleteMany({});
    await postsCollection.insertOne({
      _id: "Post1",
      task: { text: "1+1", isUrl: false },
      taskSolution: "2",
      location: {
        type: "Point",
        coordinates: [55.77, 12.49]
      }
    });
  });

  describe("Verify nearbyPlayers", () => {
    // 4)
    it("Should find (Only) Team2", async () => {
      const playersFound = await GameFacade.nearbyPlayers(
        "t1",
        "secret",
        55.77,
        12.48,
        DISTANCE_TO_SEARCH
      );
      expect(playersFound.length).to.be.equal(1);
      expect(playersFound[0].userName).to.be.equal("t2");
    });
    // 5)
    it("Should NOT find Team2 (wrong credentials)", async () => {
      try {
        const playersFound = await GameFacade.nearbyPlayers(
          "t1",
          "xxxxx",
          55.77,
          12.48,
          DISTANCE_TO_SEARCH
        );
        throw new Error("Should NEVER get here");
      } catch (err) {
        expect(err.errorCode).to.be.equal(403);
      }
    });
    // 6)
    it("Should find Team2 and Team3", async () => {
      //TODO
    });
  });

  describe("Verify getPostIfReached", () => {
    // 7)
    it("Should find the post since it was reached", async () => {
      try {
        const post = await GameFacade.getPostIfReached(
          "Post1",
          12.49,
          55.77
        )
        expect(post.postId).to.be.equal("Post1")
      } catch (err) {
        console.info(err.message)
      }
    });
    // 8)
    it("Should NOT find the post since it was NOT reached", async () => {
      try {
        const post = await GameFacade.getPostIfReached(
          "Post1",
          12.49,
          55.78
        )
        throw new Error("Should NEVER get here");
      } catch (err) {
        expect(err.errorCode).to.be.equal(400)
      }
    });
  });
});
