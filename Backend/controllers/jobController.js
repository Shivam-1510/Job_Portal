import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler, { errorMiddleware } from "../middlewares/error.js";
import { Job } from "../models/jobSchema.js";

export const postJob = catchAsyncErrors(async (req, res, next) => {
  const {
    title,
    jobType,
    location,
    companyName,
    introduction,
    responsibilities,
    qualifications,
    offers,
    salary,
    hiringMultipleCandidates,
    personalWebsiteTitle,
    personalWebsiteUrl,
    jobCategory,
  } = req.body;
  if (
    !title ||
    !jobType ||
    !location ||
    !companyName ||
    !introduction ||
    !responsibilities ||
    !qualifications ||
    !salary ||
    !jobCategory
  ) {
    return next(new ErrorHandler("All fields are required", 400));
  }
  if (
    (personalWebsiteTitle && !personalWebsiteUrl) ||
    (personalWebsiteTitle && !personalWebsiteUrl)
  ) {
    return next(
      new ErrorHandler(
        "Provide both the website url and title, or leave both blank.",
        400
      )
    );
  }
  const postedBy = req.user._id;
  const job = await Job.create({
    title,
    jobType,
    location,
    companyName,
    introduction,
    responsibilities,
    qualifications,
    offers,
    salary,
    hiringMultipleCandidates,
    personalWebsite:{
        title: personalWebsiteTitle,
        url: personalWebsiteUrl
    },
    jobCategory,
    postedBy,
  });
  res.status(201).json({
    success: true,
    message: "Job posted successfully.",
    job,
  });
});





export const getAllJobs = catchAsyncErrors(async(req,res,next) => {
    const {city, category, searchKeyword} =req.query; 
    const query ={};
    if(city){
        query.location =city;
    }
    if(category){
        query.jobCategory = category;
    }
    if(searchKeyword){
        query.$or =[
            {title: {$regex:searchKeyword, $options: "i"} },
            {companyName: {$regex: searchKeyword, $options: "i"} },
            {introduction: {$regex: searchKeyword, $options: "i"} },
        ];
    }
    const jobs = await Job.find(query);
    res.status(200).json({
        success: true,
        jobs,
        count: jobs.length,
    });
});
export const getMyJobs = catchAsyncErrors(async(req,res,next) => {
    const myJobs = await Job.find({ postedBy: req.user._id});
    res.status(200).json({
        success: true,
        myJobs,
    });
});
export const deleteJob = catchAsyncErrors(async(req,res,next) => {
    const {id} =req.params;
    const job =await Job.findById(id);
    if(!job){
        return next(new ErrorHandler("Oops! Job not found.", 404));
    }
    if (job.postedBy.toString() !== req.user._id.toString()) {
        return next(new ErrorHandler("You are not authorized to delete this job", 403));
    }
    await job.deleteOne();
    res.status(200).json({
        success: true,
        message: "Job deleted."
    });
});
export const getASingleJob = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const job = await Job.findById(id);

  if (!job) {
    return next(new ErrorHandler("Job not found", 404));
  }

  res.status(200).json({
    success: true,
    job,
  });
});
