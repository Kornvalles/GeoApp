import express from "express";
import userFacade from "../facades/userFacadeWithDB";
import authMiddleware from "../middlewares/basic-auth";
import setup from "../../config/setupDB";
import graphqlHTTP from "express-graphql";
import { buildSchema } from "graphql";
import GameUser from "../interfaces/GameUser"
import { ApiError } from "../errors/apiError";
// import { ApiError } from "../errors/apiError";
// import * as mongo from "mongodb";

const router = express.Router();
// const MongoClient = mongo.MongoClient;

const USE_AUTHENTICATION = false;

(async function setupDB() {
	const client = await setup();
	userFacade.setDatabase(client);
})();

if (USE_AUTHENTICATION) {
	router.use(authMiddleware);
}

// // Only if we need roles
// router.use("/", (req: any, res, next) => {
//   if (USE_AUTHENTICATION) {
//     const role = req.role;
//     if (role != "admin") {
//       throw new ApiError("Not Authorized", 403)
//     }
//     next();
//   }
// })


// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
	type User {
		_id: String
		name: String
		userName: String
		role: String
		password: String
	}
	
	input UserInput {
		name: String
		userName: String
		password: String
	}
	
	type Query {
		users : [User]!
	}

	type Mutation {
		createUser(input: UserInput): String
	}
`);

// The root provides a resolver function for each API endpoint
var root = {
	users: async () => {
		const users = await userFacade.getAllUsers();
		const usersDTO = users.map((user) => {
			const { _id ,name, userName, role } = user;
			return { _id , name, userName, role }
		})
		return usersDTO;
	},
	createUser: async (inp: any) => {
		const { input } = inp;
		try {
			const newUser: GameUser = {
				name: input.name,
				userName: input.userName,
				password: input.password,
				role: "user"
			}

			const status = await userFacade.addUser(newUser)
			return status;

		} catch (err) {
			throw err;
		}
	},

};

router.use('/', graphqlHTTP({
	schema: schema,
	rootValue: root,
	graphiql: true,
}));

module.exports = router;
