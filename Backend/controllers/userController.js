import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler, { errorMiddleware } from "../middlewares/error.js";
import { User } from "../models/userSchema.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";
import { sendToken } from "../utils/jwtToken.js";



const storage = multer.memoryStorage();
const upload = multer({ storage });
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const register = catchAsyncErrors(async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      password,
      role,
      firstCategory,
      secondCategory,
      thirdCategory,
      CV,
    } = req.body;

    if (!name || !email || !phone || !address || !password || !role) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    if (
      role === "Job Seeker" &&
      (!firstCategory || !secondCategory || !thirdCategory)
    ) {
      return next(
        new ErrorHandler("Please provide your preferred job categories.", 400)
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorHandler("Email is already registered", 400));
    }

    const userData = {
      name,
      email,
      phone,
      address,
      password,
      role,
      category: {
        firstCategory,
        secondCategory,
        thirdCategory,
      },
      CV,
    };
    if (req.file) {
      console.log("File received: ", req.file);
      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "Job_Seekers_Resume" },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );

          streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
        });

        userData.resume = {
          public_id: result.public_id,
          url: result.secure_url,
        };
      } catch (error) {
        console.error("Error uploading resume:", error);
        return next(new ErrorHandler("An error occurred while uploading the resume", 500));
      }
    }

    const user = await User.create(userData);
    res.status(201).json({
      success: true,
      message: "User Registered.",
    });
  } catch (error) {
    console.error("Error during registration:", error);
    next(error);
  }
});

export { upload }; // Export the upload middleware

export const login = catchAsyncErrors(async (req, res, next) => {
  const { role, email, password } = req.body;
  if (!role || !email || !password) {
    return next(
      new ErrorHandler("Email , password and role are required.", 400)
    );
  }
  const user = await User.findOne({ email }).select("+password");
  console.log(email);
  if (!user) {
    return next(new ErrorHandler("Invalid email or password. FROM EMAIL", 400));
  }
  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(
      new ErrorHandler("Invalid email or password. FROM PASSWORD", 400)
    );
  }
  if (user.role !== role) {
    return next(new ErrorHandler("Invalid user role.", 400));
  }
  sendToken(user, 200, res, "User logged in successfully.");
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200).cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    CV: req.body.CV,
    category: {
      firstCategory: req.body.firstCategory,
      secondCategory: req.body.secondCategory,
      thirdCategory: req.body.thirdCategory,
    },
  };
  const { firstCategory, secondCategory, thirdCategory } = newUserData.category;
  if (
    req.user.role === "Job Seeker" &&
    (!firstCategory || !secondCategory || !thirdCategory)
  ) {
    return next(
      new ErrorHandler("Please provide your all job prefrences.", 400)
    );
  }
  if (req.files) {
    const resume = req.files.resume; 

    if (resume) {
      const currentResumeId = req.user.resume.public_id;
      if (currentResumeId) {
        await cloudinary.uploader.destroy(currentResumeId);
      }
      const newResume = await cloudinary.uploader.upload(resume.tempFilePath, {
        folder: "Job_Seekers_Resume"
      });
      newUserData.resume = {
        public_id: newResume.public_id,
        url: newResume.secure_url,
      };
    }
  }
  
  const user = await User.findByIdAndUpdate(req.user.id, newUserData, { // Corrected the parameter order
    new: true,
    runValidators: true,
    useFindAndModify: false, // Fixed typo from userFindAndModify to useFindAndModify
  });
  
  res.status(200).json({
    success: true,
    user,
    message: "Profile updated."
  });
  
});

export const updatePassword = catchAsyncErrors(async(req,res,next) =>{
  const user = await User.findById(req.user.id).select("+password");

  const isPasswordMatched =await user.comparePassword(req.body.oldPassword);
  if(isPasswordMatched){
    return next(new ErrorHandler("Old password is incorrect.", 400));
  }
  if(req.body.newPassword !== req.body.confirmPassword){
    return next(new ErrorHandler("New password & confirm password do not match.", 400));
  } 

  user.password = req.body.newPassword;
  await user.save();
  sendToken(user, 200, res, "Password updated successfully.");
});
