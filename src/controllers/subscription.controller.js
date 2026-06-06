import mongoose,{isValidObjectId} from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
   
    // TODO: toggle subscription
    // 1. channelId ko req.params se lo
// 2. check karo channelId valid hai ya nahi
// 3. logged-in user ki id lo (req.user se)
// 4. check karo user already subscribe hai ya nahi
// 5. agar subscribed hai to unsubscribe (delete record)
// 6. agar subscribed nahi hai to subscribe (create record)
// 7. response bhejo (subscribed/unsubscribed status)
           const {channelId} = req.params

             if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }

   // findById() tab use karte hain jab document ki _id pata ho.
   //magar yaha--"Kya is user ne is channel ko subscribe kiya hua hai?"
      const isSubscribed= await Subscription.findOne({
            subscriber: req.user?._id,
              channel: channelId,
      })

       if (isSubscribed) {
        await Subscription.findByIdAndDelete(isSubscribed?._id);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { subscribed: false },
                    "unsunscribed successfully"
                )
            );
    }

    //nhi subcribe to subsvcription me add karte hai create se 
      await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId,
    });

      return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { subscribed: true },
                "subscribed successfully"
            )
        );
     

})


const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channelId"); 
    }

    //chanel ki id se users ki list nikalni hai
     channelId= new mongoose.Types.ObjectId(channelId)
      const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: channelId,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber",
                        },
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $cond: {
                                    if: {
                                        $in: [
                                            channelId,
                                            "$subscribedToSubscriber.subscriber",
                                        ],
                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                            subscribersCount: {
                                $size: "$subscribedToSubscriber",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriber",
        },
        {
            $project: {
                _id: 0,
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    subscribedToSubscriber: 1,
                    subscribersCount: 1,
                },
            },
        },
    ]);
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "subscribers fetched successfully"
            )
        );

})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannel",
                pipeline: [
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos",
                        },
                    },
                    {
                        $addFields: {
                            latestVideo: {
                                $last: "$videos",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscribedChannel",
        },
        {
            $project: {
                _id: 0,
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    latestVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        createdAt: 1,
                        views: 1
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "subscribed channels fetched successfully"
            )
        );
});




export {toggleSubscription,getUserChannelSubscribers,getSubscribedChannels}