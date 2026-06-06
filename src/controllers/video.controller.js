import mongoose,{isValidObjectId} from 'mongoose'
import {Video} from '../models/video.model.js'
import { User } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import  {uploadOnCloudinary,deleteOnCloudinary} from '../utils/cloudinary.js'
import { Like } from "../models/like.model.js"; // Path check kar lein
import { Comment } from "../models/comment.model.js"; // Path check kar lein

const getAllVideos = asyncHandler(async (req, res) => { //query = user ne search box me jo text likha hai

    // Step 1: URL se query parameters nikalo
    // Step 2: Database ke liye filter banao
    //         (search aur userId ke basis par)
    // Step 3: Sorting lagao
    // Step 4: Pagination lagao
    //         (skip aur limit)
    // Step 5: Videos database se lao
    // Step 6: Response bhejo


    //  // 1. Frontend se page, limit, search, sorting aur userId lo
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination     


     // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    const pipeline = [];

     if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }


      if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }


    
    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    
   //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )
      const videoAggregate = Video.aggregate(pipeline);
          const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };
      const video = await Video.aggregatePaginate(videoAggregate, options);

    
    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));

})

const   publishAVideo = asyncHandler(async(req,res)=>{
          const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    console.log("--- REQUEST RECEIVED ---");
    console.log("Body:", req.body);
    console.log("Files:", req.files); // Yeh check karei
           
    if(!title||title.trim()===""){
        throw new ApiError(400,"title is required")
    }

    if(!description||description.trim()===""){
        throw new ApiError(400,"description is required")
    }
   

    //title aur description mil gye ab ,,files bhi le lete hain

    const videoFileLocalPath=req.files?.videoFile[0].path;
    const thumbnailLocalPath=req.files?.thumbnail[0].path;


    
    if (!videoFileLocalPath) {
        throw new ApiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    //ab in paths ko cloudinary par upload kar dete hain

    const videoFile=await  uploadOnCloudinary(videoFileLocalPath);
    const thumbnail= await uploadOnCloudinary(thumbnailLocalPath);

    
    if (!videoFile) {
        throw new ApiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail not found");
    }

    //video file aur thumbnail clodunary me hai ab database me save karate hain,,video name se,,.create lagega time bhi
    const video= await Video.create({
        title:title,
        description:description,
        duration:videoFile.duration,
        thumbnail:{
            url:thumbnail.url,
            public_id:thumbnail.public_id
        },
        videoFile:{
            url:videoFile.url,
            public_id:videoFile.public_id
        },
        owner:req.user?._id,  //rotes me,,verifyjwt ke bad hai uplodaAvideo,,user wahi se aya
       isPublished: false

    })
    //databse me bhi dal diya 
     

    const videoUploaded= await Video.findById(video._id) //database se wapas mangate hain
    if(!videoUploaded){
         throw new ApiError(500, "videoUpload failed please try again !!!");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,video,"video uploaded successfully"))  //dabase se video ko jason formate se lekar jawascript me bhej diya
    



})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid videoId");
    }
    /* if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }*/
   const video= await Video.aggregate([
       {   //filter for same id
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
           $lookup:{
             from:"likes",   // likes collection
             localField:"_id",   // video ka id
             foreignField:"video",  // likes me video field
             as:"likes"       // result array "likes"
           }
        },
            // 3. owner (user) details fetch kar rahe hain
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",

                // owner ke andar extra processing (nested lookup)
                pipeline: [

                    // 3.1 subscription collection join
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },

                    // 3.2 extra fields calculate kar rahe hain
                    {
                        $addFields: {

                            // total subscribers count
                            subscribersCount: {
                                $size: "$subscribers"
                            },

                            // check kar rahe hain ki current user subscribed hai ya nahi
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },

                    // 3.3 sirf needed fields hi bhej rahe hain
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },

         // 4. extra calculated fields add kar rahe hain
        {
            $addFields: {

                // total likes count
                likesCount: {
                    $size: "$likes"
                },

                // owner array ko single object bana rahe hain
                owner: {
                    $first: "$owner"
                },

                // check kar rahe hain user ne like kiya hai ya nahi
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },

          // 5. final output clean kar rahe hain (sirf needed fields)
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }

   ]);

  if (!video) {
        throw new ApiError(500, "failed to fetch video");
    }

     // video fetch hone ke baad views +1 kar rahe hain
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

        // user ke watch history me video add kar rahe hain
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: videoId   // duplicate avoid karega
        }
    });

     return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "video details fetched successfully")
        );
   



})


const updateVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params
    console.log("Extracted VideoID:", videoId);
    
    //TODO: update video details like title, description, thumbnail


    // 1. req.params se videoId lo
// 2. videoId validate karo (isValidObjectId)
// 3. DB se video find karo
// 4. check karo video exist karta hai ya nahi
// 5. check karo user owner hai ya nahi
// 6. Cloudinary se video + thumbnail delete karo
// 7. DB se video record delete karo
// 8. success response bhejo

       if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }
   

      const { title, description } = req.body;

         if (!(title && description)) {
        throw new ApiError(400, "title and description are required");
    }
       //Video se import kiya hai yaha id,,db me kuchh bhi isi se dhundhenge
     const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }
    console.log("Video Owner ID:", video.owner);
console.log("Logged-in User ID:", req.user?._id);

     if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't edit this video as you are not the owner"
        );
    }
    //deleting old thumbnail and updating with new one
     const thumbnailToDelete = video.thumbnail.public_id;

         const thumbnailLocalPath = req.file?.path; //jo thumbnail ham denge

          if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail is required");
    }

       const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(400, "thumbnail not found");
    }

    const updatedVideo = await Video.findByIdAndUpdate(

        videoId,
          {
            //$set MongoDB ka update operator (modifier) hai.

              $set:{
                title,
                description,
                thumbnail:{
                    public_id:thumbnail.public_id,
                    url:thumbnail.url
                }
              }
          },
          {
            new:true
          }
    )
  

      if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video please try again");
    }

    //ab clodinary se purana wala hata dete hain
     if (updatedVideo) {
        await deleteOnCloudinary(thumbnailToDelete);
    }


 return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    // 1. DB mein dhundho
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    // 2. Ownership check
    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You can't delete this video as you are not the owner");
    }

    // 3. Delete from DB (Aapne 'videoDeleted' variable use kiya tha par declare nahi tha)
    const videoDeleted = await Video.findByIdAndDelete(videoId);

    if (!videoDeleted) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    // 4. Cloudinary se files delete karein
    if (video.thumbnail?.public_id) {
        await deleteOnCloudinary(video.thumbnail.public_id);
    }
    
    if (video.videoFile?.public_id) {
        await deleteOnCloudinary(video.videoFile.public_id, "video");
    }

    // 5. Likes aur Comments clean up karein
    await Like.deleteMany({ video: videoId });
    await Comment.deleteMany({ video: videoId });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    // 1. req.params se videoId lo
// 2. videoId validate karo
// 3. DB se video find karo
// 4. check karo video exist karta hai ya nahi
// 5. check karo user video ka owner hai ya nahi
// 6. current isPublished value dekho
// 7. isPublished ko toggle karo (true ↔ false)
// 8. updated video DB me save karo
// 9. success response bhejo
      if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video=  await Video.findById(videoId)

     if (!video) {
        throw new ApiError(404, "Video not found");
    }

    //tum malik ho?
     if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner"
        );
    }
       //upade me $set use ,{new:true},,findandupdatebyid me id bhi dena padsta hai
        const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    );
   
        if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished },
                "Video publish toggled successfully"
            )
        );



})





export {getAllVideos,publishAVideo,getVideoById,updateVideo,deleteVideo,togglePublishStatus}