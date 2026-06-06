import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

        // 1. logged-in user ki channel id lena
    // 2. us channel ke saare videos dhundhna
    // 3. sab videos ke views ka total nikalna
    // 4. channel ke total subscribers count karna
    // 5. channel ke total videos count karna
    // 6. channel ke videos par total likes count karna
    // 7. saare stats ko ek object me combine karna
    // 8. stats response me bhejna

    const userId = req.user?._id; //kuchh bahar se nhi diya ye khud count karega,,

    const totalSubscribers =await Subscription.aggregate([
        {
            $match:{
                channel:new mongoose.Types.ObjectId(userId)
            }
        },
        {
                        $group: {
                _id: null,
                subscribersCount: {
                    $sum: 1
                }
            }

        }
    ])

    const video= await Video.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },{
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"likes"
            }
        },

    // Lookup ke baad:
    /*
    [
      {
        _id: 101,
        views: 1000,
        likes: [
          {...},
          {...}
        ]
      },
      {
        _id: 102,
        views: 2000,
        likes: [
          {...},
          {...},
          {...}
        ]
      }
    ]
    */
        
        {
            $project:{ //project--ye help karat hai output me kaun si file rakhani hai kaun si ahtani hai
                  totalLikes: {
                    $size: "$likes"
                },
                totalViews: "$views",
                totalVideos: 1

            }
        },
          // Project ke baad:
    /*
    [
      {
        totalLikes: 2,
        totalViews: 1000,
        totalVideos: 1
      },
      {
        totalLikes: 3,
        totalViews: 2000,
        totalVideos: 1
      }
    ]
    */
        
        {
               // 4. Sab videos ko ek group me daal do
               // Aur totals nikal do
             $group: {
            _id: null,

            // 2 + 3 = 5
            totalLikes: {
                $sum: "$totalLikes"
            },

            // 1000 + 2000 = 3000
            totalViews: {
                $sum: "$totalViews"
            },

            // 1 + 1 = 2 videos
            totalVideos: {
                $sum: 1
            }
        }

        }

    ])

       const channelStats = {
        totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
        totalLikes: video[0]?.totalLikes || 0,
        totalViews: video[0]?.totalViews || 0,
        totalVideos: video[0]?.totalVideos || 0
    };

    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channelStats,
                "channel stats fetched successfully"
            )
        );

})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
      // 1. logged-in user/channel ki id len
    // 2. database me owner = userId wale saare videos dhundhna
    // 3. agar koi video na mile to empty array return karna
    // 4. videos ko response me bhejna

    const userId= req.user?._id

    const videos= await Video.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
               {  //sare vidoes ke likes ki sankhya ,,video wise strore
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
                {
            $addFields: {
                createdAt: {
                    $dateToParts: { date: "$createdAt" }
                },
                likesCount: {
                    $size: "$likes"
                }
                //likes array ki length nikal do
            }
        },

            {
            $sort: {  //new ->old->oldest video
                createdAt: -1
            }
        },
          {
            $project: {
                _id: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                title: 1,
                description: 1,
                createdAt: {
                    year: 1,
                    month: 1,
                    day: 1
                },
                isPublished: 1,
                likesCount: 1
            }
        }

        
    ])


       return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            videos,
            "channel stats fetched successfully"
        )
    );
})



export {getChannelStats,getChannelVideos}