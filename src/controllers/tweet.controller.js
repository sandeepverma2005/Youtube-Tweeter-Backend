

import mongoose,{isValidObjectId} from "mongoose";
import {Tweet} from "../models/tweet.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    // 1. req.body se tweet content lo
    // 2. check karo ki tweet empty to nahi hai
    // 3. logged-in user ki id lo (req.user se)
    // 4. tweet ko database me create karo (Tweet.create)
    // 5. agar creation fail ho to error throw karo
    // 6. success response bhejo (created tweet return karo)

    const {content}= req.body;
   

    if(!content){
        throw new ApiError(400,"Content is required")
    }

    const tweet= await Tweet.create({
        content,
      owner:  req.user?._id

    })


    if(!tweet){
         throw new ApiError(500, "failed to create tweet please try again");
    }

     return res
        .status(200)
        .json(new ApiResponse(200, tweet, "Tweet created successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
   // 1. logged-in user ki id lo (req.user se) ya barhar se le to req.params
// 2. check karo user id exist karti hai ya nahi
// 3. database me us user id ke tweets search karo
// 4. agar tweets nahi mile to error throw karo
// 5. success response me tweets return karo
  const {userId}= req.params;
  if(!isValidObjectId(userId)){
      throw new ApiError(400, "Invalid userId");
  }
   
    const tweets = await Tweet.aggregate([
        {  //Jinka owner = userId hai
        $match:{
            owner: new mongoose.Types.ObjectId(userId)
        }

    },{  //Tweet ke owner ko users collection se join kar rahe ho
         $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                        },
                    },
                ],
            }
    },{        //likes collection se match kar rahe ho tweet _id pe
        
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1,
                        },
                    },
                ],
            },
    },{
        $addFields: {
                likesCount: {
                    $size: "$likeDetails",
                },
                ownerDetails: {
                    $first: "$ownerDetails",
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likeDetails.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
    },{
         $sort: {
                createdAt: -1
            }
    }, {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1
            },
        },

])
  return res
        .status(200)
        .json(new ApiResponse(200, tweets, "Tweets fetched successfully"));


})


const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet

    // 1. tweetId lo (req.params se)
// 2. update data lo (req.body se)
// 3. check karo tweet exist karta hai ya nahi + owner logged-in user hi hai
// 4. agar match nahi hua to unauthorized error throw karo
// 5. agar match hua to tweet update karo
// 6. updated tweet response me return karo


      const {content}=req.body;
      const {tweetId}=req.params;

      
    if (!content) {
        throw new ApiError(400, "content is required");
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const tweet=  await Tweet.findById(tweetId);

      if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only owner can edit thier tweet");
    }

     const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content,
            },
        },
        { new: true }
    );

        if (!newTweet) {
        throw new ApiError(500, "Failed to edit tweet please try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, newTweet, "Tweet updated successfully"));
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    // 1. tweetId lo (req.params se)
// 2. check karo tweet exist karta hai ya nahi + owner logged-in user hi hai
// 3. agar match nahi hua to unauthorized error throw karo
// 4. agar match hua to tweet delete karo
// 5. success response bhejo
           const {tweetId}=req.params;

            if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    //ab ush id se tweet model,,db me jate hai,,Database se us tweetId wala single(kewal 1) tweet nikaal raha hai.,,.find() hta to multiple
        const tweet = await Tweet.findById(tweetId);

         if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }
      
        if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only owner can delete thier tweet");
    }
      
    await Tweet.findByIdAndDelete(tweetId)
  
      return res
        .status(200)
        .json(new ApiResponse(200, {tweetId}, "Tweet deleted successfully"));


})







export {createTweet,getUserTweets,updateTweet,deleteTweet}