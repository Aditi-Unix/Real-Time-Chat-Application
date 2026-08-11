import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";


// ==============================
// REGISTER USER
// ==============================

export const registerUser = async (req, res) => {
    try {

        const {
            name,
            email,
            password
        } = req.body;


        // Check required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }


        // Check password length
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }


        // Check existing user
        const existingUser = await User.findOne({
            email
        });


        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }


        // Hash password
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );


        // Create user
        const user = await User.create({

            name,

            email,

            password: hashedPassword

        });


        res.status(201).json({

            message: "User registered successfully",

            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }

        });

    } catch (error) {

        console.log(
            "REGISTER ERROR:",
            error
        );

        res.status(500).json({

            message: "Registration failed",

            error: error.message

        });

    }
};


// ==============================
// LOGIN USER
// ==============================

export const loginUser = async (req, res) => {
    try {

        const {
            email,
            password
        } = req.body;


        // Required fields
        if (!email || !password) {

            return res.status(400).json({

                message:
                    "Email and password are required"

            });

        }


        // Find user
        const user = await User.findOne({
            email
        });


        if (!user) {

            return res.status(401).json({

                message:
                    "Invalid email or password"

            });

        }


        // Compare password
        const isPasswordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!isPasswordCorrect) {

            return res.status(401).json({

                message:
                    "Invalid email or password"

            });

        }


        // Create JWT
        const token = jwt.sign(

            {
                userId: user._id
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );


        res.status(200).json({

            message:
                "Login successful",

            token,

            user: {

                id: user._id,

                name: user.name,

                email: user.email,

                profileImage:
                    user.profileImage

            }

        });

    } catch (error) {

        console.log(
            "LOGIN ERROR:",
            error
        );

        res.status(500).json({

            message:
                "Login failed",

            error:
                error.message

        });

    }
};