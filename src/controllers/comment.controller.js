import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"


const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query 



    
    const video= await Video.findById(videoId);

      if (!video) {
        throw new ApiError(404, "Video not found");
    }

     const commentsAggregate= Comment.aggregate([
        {
            $match:{
                video: new mongoose.Types.ObjectId(videoId)
            }

        },{
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },{
            
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },{
            $addFields:{
                likesCounts:{
                    $size:"$likes"
                },
                owner:{
                    $first:'owner'
                },
                 isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }

            }
        }
        ,{
          $sort:{
            createdAt:-1
          }  
        },
        {
             $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1
                },
                isLiked: 1
            }

        }
     ]);

     //limit
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };
   
     return res
        .status(200)
        .json(new ApiResponse(200, options, "Comments fetched successfully"));


})


const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    // URL se videoId lo
// Body se comment content lo
// Check karo video exist karta hai ya nahi
// Content empty hai to error do
// Naya comment create karo
// content + videoId + logged-in user ka id
// Comment DB me save karo
// Success response bhejo

     const {videoId}= req.params;
     const {content}=req.body;

      if (!content) {
        throw new ApiError(400, "Content is required");
    }

 const   video= await Video.findById(videoId);

    
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

   const comment= await Comment.create({
       content,
       video:videoId,
       owner:req.user?._id
   });


   
    if (!comment) {
        throw new ApiError(500, "Failed to add comment please try again");
    }

     return res
        .status(201)
        .json(new ApiResponse(201, comment, "Comment added successfully"));
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment

        // URL se commentId lo
    // Body se naya content lo
    // Content empty hai to error do
    // Comment ko DB se nikalo
    // Comment na mile to error do
    // Check karo comment owner wahi user hai ya nahi
    // Content update karo
    // Updated comment return karo
    // Success response bhejo

    const {commentId}=req.params;
    const {content}=req.body;

     if (!content) {
        throw new ApiError(400, "content is required");
    }

    const comment= await Comment.findById(commentId);


      if (!comment) {
        throw new ApiError(404, "Comment not found");
    }


      if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can edit their comment");
    }

    const updatedComment= await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set:{
                content
            }
        },
          { new: true }
    )


       if (!updatedComment) {
        throw new ApiError(500, "Failed to edit comment please try again");
    }

      return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment edited successfully")
        );
})

const deleteComment= asyncHandler(async(req,res)=>{
       // URL se commentId lo
    // Comment ko DB se nikalo
    // Comment na mile to error do
    // Check karo comment owner wahi user hai ya nahi
    // Comment delete karo
    // Delete successful response bhejo
    const {commentId}=req.params;
    const comment=await Comment.findById(commentId);

     if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

        if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can delete their comment");
    }

    await Comment.findByIdAndDelete(commentId)

    await Like.deleteMany({
        comment:commentId,
       likedBy:req.user
    })


     return res
        .status(200)
        .json(
            new ApiResponse(200, { commentId }, "Comment deleted successfully")
        );
})


export {getVideoComments,addComment,updateComment,deleteComment}