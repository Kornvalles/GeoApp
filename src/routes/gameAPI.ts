import express from "express";
import gameFacade from "../facades/gameFacade";
const router = express.Router();
import { gameArea } from "../utils/geoUtils"
import { ApiError } from "../errors/apiError";
const gju = require("geojson-utils")

//import * as mongo from "mongodb"
import setup from "../config/setupDB";
// import UserFacade from "../facades/userFacadeWithDB";

/*
 Create a new polygon meant to be used on clients by React Native's MapView which
 requres an object as the one we create below 
 NOTE --> how we swap longitude, latitude values
*/
let polygonForClient: any = {};
polygonForClient.coordinates = gameArea.coordinates[0].map(point => {
  return {latitude: point[1], longitude: point[0]}
});
 
(async function setupDB() {
  const client = await setup();
  gameFacade.setDatabase(client);
})();

router.get("/", async function (req, res, next) {
  res.json({ msg: "Welcome to the Game API!" });
});

//Returns a polygon, representing the gameArea
router.get("/gamearea",(req,res)=>{
  res.json(polygonForClient);
});

router.get('/isuserinarea/:lon/:lat', function(req, res) {
  const lon = req.params.lon;
  const lat = req.params.lat;
  const point = {"type":"Point","coordinates":[lon,lat]}
  let isInside = gju.pointInPolygon(point,gameArea);
  let result = <any>{};
  result.status = isInside;
  let msg = isInside ? "Point was inside the tested polygon":
                       "Point was NOT inside tested polygon";
  result.msg = msg;
  res.json(result);
});

router.post("/nearbyplayers", async function (req, res, next) {
  try {
    const nearbyPlayers = await gameFacade.nearbyPlayers(
      req.body.userName,
      req.body.password,
      req.body.lat,
      req.body.lon,
      req.body.distance
    );
    res.send(nearbyPlayers);
  } catch (err) {
    next(err)
  }
});

router.post("/getPostIfReached", async function (req, res, next) {
  try {
    const post = await gameFacade.getPostIfReached(
      req.body.postId,
      req.body.lat,
      req.body.lon
    );
    res.send(post)
  } catch (err) {
    next(err)
  }
});

module.exports = router;
