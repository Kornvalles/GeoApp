// var auth = require('basic-auth')
// var compare = require('tsscmp')
import auth from "basic-auth";
import compare from "tsscmp";
import {Response} from "express";
import UserFacade from '../facades/userFacadeWithDB';
 
// Create server
var authMiddleware = async function (req: any, res: Response, next: Function) {
  var credentials = auth(req)
 
  try {
    if (credentials && await UserFacade.checkUser(credentials.name, credentials.pass)) {
      const user = await UserFacade.getUser(credentials.name)
      req.userName = user.userName;
      req.role = user.role;
      return next();
    }
  } catch (err) { }
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="example"')
    res.end('Access denied')
}
export default authMiddleware