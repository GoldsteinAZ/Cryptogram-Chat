import express from "express";
import {
  checkAuth,
  login,
  logout,
  signup,
  updateProfile,
  updatePublicKey,
  deleteAccount,
  updatePreferences,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/public-key", protectRoute, updatePublicKey);
router.put("/preferences", protectRoute, updatePreferences);
router.delete("/delete", protectRoute, deleteAccount);

router.get("/check", protectRoute, checkAuth);

export default router;
