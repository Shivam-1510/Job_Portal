import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Application } from "../models/applicationSchema.js";
import { Job } from "../models/jobSchema.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const postApplication = [
  upload.single('resume'), // Add this line to handle file upload
  catchAsyncErrors(async (req, res, next) => {
    const { id } = req.params;
    const { name, email, phone, address, CV } = req.body;

    if (!name || !email || !phone || !address || !CV) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    const jobSeekerInfo = {
      id: req.user._id,
      name,
      email,
      phone,
      address,
      CV,
      role: "Job Seeker",
    };

    const jobDetails = await Job.findById(id);
    if (!jobDetails) {
      return next(new ErrorHandler("Job not found.", 404));
    }

    const isAlreadyApplied = await Application.findOne({
      "jobInfo.jobId": id,
      "jobSeekerInfo.id": req.user._id,
    });

    if (isAlreadyApplied) {
      return next(new ErrorHandler("You have already applied for this job.", 400));
    }

    if (req.file) {
      // File handling with multer
      const bufferStream = streamifier.createReadStream(req.file.buffer);
      try {
        const cloudinaryResponse = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "Job_Seekers_Resume" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          bufferStream.pipe(uploadStream);
        });

        if (!cloudinaryResponse || cloudinaryResponse.error) {
          return next(new ErrorHandler("Failed to upload resume to cloudinary.", 500));
        }

        jobSeekerInfo.resume = {
          public_id: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
        };
      } catch (error) {
        return next(new ErrorHandler("Failed to upload resume", 500));
      }
    } else {
      if (req.user && !req.user.resume.url) {
        return next(new ErrorHandler("Please upload your resume.", 400));
      }
      jobSeekerInfo.resume = {
        public_id: req.user && req.user.resume.public_id,
        url: req.user && req.user.resume.url,
      };
    }

    const employerInfo = {
      id: jobDetails.postedBy,
      role: "Employer",
    };

    const jobInfo = {
      jobId: id,
      jobTitle: jobDetails.title,
    };

    const application = await Application.create({
      jobSeekerInfo,
      employerInfo,
      jobInfo,
    });

    res.status(201).json({
      success: true,
      message: "Application submitted.",
      application,
    });
  })
];

export const employerGetAllApplication = catchAsyncErrors(
  async (req, res, next) => {
    const { _id } = req.user;
    const applications = await Application.find({
      "employerInfo.id": _id,
      "deletedBy.employer": false,
    });
    res.status(200).json({
      success: true,
      applications,
    });
  }
);

export const jobSeekerGetAllApplication = catchAsyncErrors(
  async (req, res, next) => {
    const { _id } = req.user;
    const applications = await Application.find({
      "jobSeekerInfo.id": _id,
      "deletedBy.jobSeeker": false,
    });
    res.status(200).json({
      success: true,
      applications,
    });
  }
);

export const deleteApplication = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const application = await Application.findById(id);
  if (!application) {
    return next(new ErrorHandler("Application not found.", 404));
  }
  const { role } = req.user;
  switch (role) {
    case "Job Seeker":
      application.deletedBy.jobSeeker = true;
      await application.save();
      break;
    case "Employer":
      application.deletedBy.employer = true;
      await application.save();
      break;

    default:
      console.log("Default case for application delete function.");
      break;
  }

  if (
    application.deletedBy.employer === true &&
    application.deletedBy.jobSeeker === true
  ) {
    await application.deleteOne();
  }
  res.status(200).json({
    success: true,
    message: "Application Deleted.",
  });
});