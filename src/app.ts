require('dotenv').config();
import express from "express";
import path from "path";
import { ApiError } from "./errors/apiError";
import cors from "cors";

const app = express();

app.use(cors())

app.use(express.static(path.join(process.cwd(),"public")))

app.use(express.json())
//let userAPIRouter = require('./routes/userApi');
let userAPIRouter = require('./routes/userApiDB');
let gameAPIRouter = require('./routes/gameAPI');
let graphqlAPIRouter = require('./routes/graphqlAPI');

app.use("/api/game", gameAPIRouter);
app.use("/api/users", userAPIRouter);
app.use("/graphql", graphqlAPIRouter);

app.get("/api/dummy", (req, res) => {
  res.json({ msg: "Hello" })
})

app.use(function (req, res, next) {
  if(req.originalUrl.startsWith("/api")){
      res.status(404).json({code:404, msg:"this API does not contain this endpoint"})
  }
  next()
})

app.use(function (err:any, req:any, res:any, next:Function) {
  if(err instanceof(ApiError)){
    const e = <ApiError> err;
    res.status(e.errorCode).send({code:e.errorCode,message:e.message})
  }
  next(err)
})

const PORT = process.env.PORT || 3333;
const server = app.listen(PORT)
console.log(`Server started, listening on port: ${PORT}`)
module.exports.server = server;


