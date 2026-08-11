import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


// ==============================
// GET ALL USERS
// ==============================

router.get("/", authMiddleware, async (req, res) => {
    try {

        const users = await User.find({
            _id: {
                $ne: req.user._id
            }
        })
            .select("-password")
            .sort({ name: 1 });

        res.status(200).json({
            message: "Users fetched successfully",
            count: users.length,
            users
        });

    } catch (error) {

        console.log("GET USERS ERROR:", error);

        res.status(500).json({
            message: "Error fetching users",
            error: error.message
        });

    }
});


// ==============================
// SEARCH USERS
// ==============================

router.get("/search/:query", authMiddleware, async (req, res) => {
    try {

        const query = req.params.query;

        const users = await User.find({

            _id: {
                $ne: req.user._id
            },

            $or: [
                {
                    name: {
                        $regex: query,
                        $options: "i"
                    }
                },
                {
                    email: {
                        $regex: query,
                        $options: "i"
                    }
                }
            ]

        })
            .select("-password");

        res.status(200).json({
            message: "Search results",
            count: users.length,
            users
        });

    } catch (error) {

        console.log("SEARCH USER ERROR:", error);

        res.status(500).json({
            message: "Error searching users",
            error: error.message
        });

    }
});


// ==============================
// GET SINGLE USER
// ==============================

router.get("/:userId", authMiddleware, async (req, res) => {
    try {

        const user = await User.findById(
            req.params.userId
        ).select("-password");

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        res.status(200).json({
            message: "User fetched successfully",
            user
        });

    } catch (error) {

        console.log("GET USER ERROR:", error);

        res.status(500).json({
            message: "Error fetching user",
            error: error.message
        });

    }
});


export default router;