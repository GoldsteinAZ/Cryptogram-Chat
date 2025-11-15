import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addContact, removeContact } from "../controllers/contact.controller.js";

const router = express.Router();

router.post("/", protectRoute, addContact);
router.delete("/:id", protectRoute, removeContact);

export default router;
