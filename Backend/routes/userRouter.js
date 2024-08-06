import express from "express";
import {register, upload, login, logout, getUser, updateProfile, updatePassword} from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/auth.js";



const router = express.Router();


router.post('/register', upload.single('resume'), register);
router.post("/register", register);
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/getuser", isAuthenticated, getUser, );
router.post('/update/profile', isAuthenticated, upload.single('resume'), updateProfile);
router.put("/update/password", isAuthenticated, updatePassword)

export default router;
