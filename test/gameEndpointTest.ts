import path from "path";
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
import { expect } from "chai";
import { Server } from "http";
import fetch from "node-fetch";
import mongo, { MongoClient } from "mongodb";
import { bryptAsync } from "../src/utils/bcrypt-async-helper";
import setup from "../src/config/setupDB";
import {
  positionCreator,
  getLatitudeInside,
  getLatitudeOutside
} from "../src/utils/geoUtils";
import {
  USER_COLLECTION_NAME,
  POSITION_COLLECTION_NAME,
  POST_COLLECTION_NAME
} from "../src/config/collectionNames";
import { ApiError } from "../src/errors/apiError";

let server: Server;
let client: MongoClient;
const TEST_PORT = "7777";
const DISTANCE_TO_SEARCH = 10;
const MOCHA_TIMEOUT = 5000;

let usersCollection: mongo.Collection | null;
let positionsCollection: mongo.Collection | null;
let postsCollection: mongo.Collection | null;

let team1: any;
let team2: any;
let team3: any;

describe("Verify the GameAPI", () => {
  let URL: string;

  before(async function () {
    // @ts-ignore
    this.timeout(MOCHA_TIMEOUT);
    process.env["PORT"] = TEST_PORT;
    process.env["DB_NAME"] = "semester_case_test";

    server = await require("../src/app").server;
    URL = `http://localhost:${process.env.PORT}`;
    client = await setup();
    const db = client.db(process.env.DB_NAME);

    positionsCollection = db.collection(POSITION_COLLECTION_NAME);
    usersCollection = db.collection(USER_COLLECTION_NAME);
    postsCollection = db.collection(POST_COLLECTION_NAME);
  });
  after(async () => {

    server.close();
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
    team1 = {
      name: "Team1",
      userName: "t1",
      password: secretHashed,
      role: "team"
    };
    team2 = {
      name: "Team2",
      userName: "t2",
      password: secretHashed,
      role: "team"
    };
    team3 = {
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
    it("Should find team2, since inside range", async function () {
      // @ts-ignore
      // this.timeout(MOCHA_TIMEOUT);
      const newPosition = {
        userName: "t1",
        password: "secret",
        lat: 55.77,
        lon: 12.48,
        distance: DISTANCE_TO_SEARCH
      };
      const config = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newPosition)
      };
      const result = await fetch(
        `${URL}/gameapi/nearbyplayers`,
        config
      ).then(r => r.json());
      expect(result.length).to.be.equal(1);
      expect(result[0].name).to.be.equal("Team2");
    });

    it("Should find team2 + team3, since both are inside range", async function () {
      const newPosition = {
        userName: "t1",
        password: "secret",
        lat: 55.77,
        lon: 12.48,
        distance: DISTANCE_TO_SEARCH + 1
      };
      const config = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newPosition)
      };
      const result = await fetch(
        `${URL}/gameapi/nearbyplayers`,
        config
      ).then(r => r.json());
      expect(result.length).to.be.equal(2);
      expect(result.map((r: { name: String; }) => r.name)).to.be.eql([team2.name, team3.name]);
    });

    it("Should NOT find team2, since not in range", async function () {
      const newPosition = {
        userName: "t1",
        password: "secret",
        lat: 55.77,
        lon: 12.48,
        distance: DISTANCE_TO_SEARCH - 2
      };
      const config = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newPosition)
      };
      const result = await fetch(
        `${URL}/gameapi/nearbyplayers`,
        config
      ).then(r => r.json());
      expect(result.length).to.be.equal(0);
      expect(result[0]).to.be.equal(undefined);
    });

    it("Should NOT find team2, since credential are wrong", async function () {
      const newPosition = {
        userName: "t1",
        password: "xxxx",
        lat: 55.77,
        lon: 12.48,
        distance: DISTANCE_TO_SEARCH
      };
      const config = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newPosition)
      };
      try {
        await fetch(`${URL}/gameapi/nearbyplayers`, config)
          .then(r => r.json())
      } catch (err) {
        expect(err.errorcode).to.be.equal(403)
      }
    });

    xit("Should .....", async () => { });
  });

  describe("Verify getPostIfReached", () => {

    it("Should find post", async () => {
      // @ts-ignore
      // this.timeout(MOCHA_TIMEOUT);
      const postToFind = {
        postId: "Post1",
        lat: 55.77,
        lon: 12.49
      };
      const config = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(postToFind)
      };
      try {
        const post = await fetch(`${URL}/gameapi/getPostIfReached`, config)
          .then(r => r.json())
        expect(post.postId).to.be.equal("Post1")
      } catch (err) {
        throw new Error("Should NOT get here!");
      };
    });
  
  });

});



