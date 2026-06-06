import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
 const generateAccessAndRefereshTokens = async(userId)=>{
     try{
        const user= await User.findById(userId)
        const accessToken=   user.generateAccessToken()
        const refreshToken=   user.generateRefreshToken()

        user.refreshToken = refreshToken
       await  user.save({validateBeforeSave: false})

       return {accessToken,refreshToken}


       
     }catch(error){
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
     }
 }
const registerUser = asyncHandler(async (req, res) => {
      //get user details from frontend
      //validation -- not empty
      //check if user already exits: username,eamil
      //upload them yo cloudinary ,,avatr
      //create user object -- catreate entry in db
      //remove password and refresh token field from response
      //check the user creation
      //return res
  
    // 1. Get user details from request body
    const { fullName, email, username, password } = req.body;
     
    // 2. Validation: Check if fields are empty
    if (!fullName || !email || !username || !password) {
        throw new ApiError(400, "All fields are required");
    }

    // 3. Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // 4. Handle file uploads (Avatar is required)
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    /*
     let coverImageLocalPath;
     if(req.files &&Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
        coverImageLocalPath= req.files.coverImage[0].path;
     }
    
    */

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    //yaha lekar coludinary par de diya(frontend se lekar)

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    // 5. Create user object in DB
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    // 6. Remove sensitive fields from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // 7. Send response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    );
});

const loginUser = asyncHandler(async (req,res)=>{
      //req body se data lao
      //check kare ,username or email hai ki nhi
      //find the user
      //password check
      //access and refresh token should generate
      //send cookie

       // frontend/postman se email, username aur password nikalo
      const {email,username,password}= req.body

      //if(!username || ! email){
      //  throw new ApiError(400,"username or password is required")
     // }

       if(!username && ! email){
        throw new ApiError(400,"username and password are required")
      }
         // database me user ko dhundo
      // username se ya email se

    const user= await  User.findOne({
        $or: [{username},{email}]
      })

      if(!user){
        throw new ApiError(404,"User does not exist")
      }

    // user ne jo password diya hai
      // use database ke hashed password se compare karo
   const isPasswordValid=  await user.isPasswordCorrect (password) //password--> hamara wala password jo body se liya,,user -->jo abhi hamne databse se liya hai
    if(!isPasswordValid){
        throw new ApiError(401,"Invalied user credentials")
      }

   const {accessToken,refreshToken}= await  generateAccessAndRefereshTokens(user._id)
          // user ko dubara database se lao
      // lekin password aur refresh token mat lao
   const loggedInUser= await User.findById(user._id).
   select("-password -refreshToken")

   const options= {
     httpOnly :true,// frontend JS cookie nahi padh sakta
     secure:true     // sirf HTTPS par cookie bhejna
   }

   return res
   .status(200)
   .cookie("accessToken",accessToken,options)     // browser me access token naam ki cookie save kar do
   .cookie("refreshToken",refreshToken,options)
   .json(   // final JSON response bhejo
    new ApiResponse(  
        200,
        {
            user: loggedInUser,accessToken,refreshToken
        },
        "User logged In Successfully"
    )
   )





})

const logoutUser = asyncHandler(async(req,res)=>{
    /*
    1. req.user._id se current user mila
2. Database se refreshToken hata diya
3. accessToken cookie delete kar di
4. refreshToken cookie delete kar di
5. Logout success response bhej diya
     */
      // database me current logged-in user ko update karo
  await  User.findByIdAndUpdate(

    // kis user ko update karna hai?
    // middleware ne token verify karke req.user me user save kiya tha
    req.user._id,
    {
        $unset: {
            refreshToken: 1 //. Database se refreshToken hata diya
        }
    },{
        new :true
    }
   )


    const options= {
     httpOnly :true,
     secure:true
   }

   return res
   .status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200,{},"User logged Out"))
})
/*
Access Token expire ho gaya
       ↓
Refresh Token se naya Access Token bana do
       ↓
User ko dobara login na karna pade  

*/

const refreshAccessToken = asyncHandler(async(req,res)=>{
    //cookie se lekar refresh kar sakate hain
    const incomingRefreshToken= req.cookies.refreshToken||req.body.refreshToken
    if(!incomingRefreshToken){
         throw new ApiError(401,"unauthorized request")
    }
try{
 const decodedToken=   jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )
  const user= await   User.findById(decodedToken?._id)
      if(!user){
         throw new ApiError(401,"Invalied refresh token")
    }

     console.log("Incoming Token:", incomingRefreshToken);

console.log("DB Token:", user.refreshToken);

console.log(
    "Match:",
    incomingRefreshToken === user.refreshToken
);

    if(incomingRefreshToken!==user?.refreshToken){
        throw new ApiError(401,"Refresh token is expired or used")
    }

  const options= {
    httpOnly:true,
    secure:true,
    path: "/"
    
  }
 //


    const {accessToken,newRefreshToken}=await  generateAccessAndRefereshTokens(user._id)

return res
.status(200)
.cookie("accessToken",accessToken)
.cookie("refreshToken",newRefreshToken)
.json(
    new ApiResponse(
        200,
        {
            accessToken,refreshToken: newRefreshToken
        },
        "Acccess token refreshed"
    )
)}
catch(error){
    throw new ApiError(401,error?.message||"Invalid refresh token")
}



})

const changeCurrentPassword= asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}= req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
         throw new ApiError(404,"Invalid old password")
    }

    user.password= newPassword //sirf Ram me value badla hai abhi databse me nhi
    await user.save({validateBeforeSave:false}) //user.save(),,Ram->mongoDB
    return res
        .status(200)
        .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetched successfully"))
})

const updateAccountDetails= asyncHandler(async(req,res)=>{
    const {fullName,email}= req.body
    if(!fullName||!email){
        throw new ApiError(400,"All fields are required")
    }
// database me user ko find karo aur update bhi karo
 const user= await  User.findByIdAndUpdate(
        req.user?._id,
        {

        // in fields ki value change (set) karo
            $set:{
                    // fullName ko naye fullName se update karo
                fullName,
                  // email ko naye email se update karo
                email: email
            }
        },
           // updated document return karo
    // purana document nahi
        {new:true}

    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar= asyncHandler(async(req,res)=>{
     const avatarLocalPath=   req.file?.path
     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
     }
          //todo : delelete old image -assignment
        
     // 1. pehle user ko DB se lao
const existingUser = await User.findById(req.user?._id)
  if (!existingUser) {
        throw new ApiError(404, "User not found");
    }

// old avatar URL
const oldAvatarUrl = existingUser.avatar

// URL se public_id nikalne ki koshish
    if (oldAvatarUrl) {

        const parts = oldAvatarUrl.split("/");

        const lastPart = parts[parts.length - 1];

        const oldAvatarPublicId = lastPart.split(".")[0];

        if (oldAvatarPublicId) {
            await cloudinary.uploader.destroy(oldAvatarPublicId);
        }
    }
    
   ////
     const avatar= await uploadOnCloudinary(avatarLocalPath)

     if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
     }

   const user=   await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },{
            new:true
        }
     ).select("-password")

     return res
     .status(200)
     .json(
        new ApiResponse(200,user,"Avatar imageupdated successfully")
     )
})

const updateUserCoverImage= asyncHandler(async(req,res)=>{
     const coverImageLocalPath=   req.file?.path
     if(!coverImageLocalPath){
        throw new ApiError(400, "coverImage file is missing")
     }

     const coverImage= await uploadOnCloudinary(coverImageLocalPath)

     if(!avatar.url){
        throw new ApiError(400,"Error while uploading on CoverImage")
     }

  const user=    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },{
            new:true
        }
     ).select("-password")

     return res
     .status(200)
     .json(
        new ApiResponse(200,user,"Cover imageupdated successfully")
     )
})
//yaha se error fix karana hai,,rout me path bhi

const getUserChannelProfile = asyncHandler(async(req,res)=>{
         const {username}= req.params //url se nikala body se nhi
         if(!username?.trim()){
            throw new ApiError(400,"username is missing")

         }
     //values array ke rup mev ate hain ,aggration pipeline me 
     const channel =await   User.aggregate([
        // User collection me username search karo
        {
        $match:{
            username: { $regex: new RegExp(`^${username.trim()}$`, "i") }
        }
     },
      // Subscription collection se us channel ke subscribers lao
     {
        $lookup:{
            from:"subscriptions", // collection name
            localField:"_id",          // User ka _id
            foreignField:"channel",     // Subscription me channel field
            as:"subscribers"          // result subscribers array me store hoga

        }
     },
                 // Ye dekhega ki ye user khud kin channels ko subscribe karta hai

     
     {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"

        }
     },{
            // Naye fields add kar rahe hain
        $addFields: {
              // Subscribers kitne hain
        subscribersCount:{
            $size:"$subscribers"
        },
        channelsSubscribedToCount:{
            $size:"$subscribedTo"
        },
        isSubscribed:{
            $cond:{
                if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                then:true,
                else:false
             }
             }
        }
     },{
        $project:{
            fullName:1,
            username:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
              isSubscribed:1,
              avatar:1,
              coverImage:1,
              email:1

        }
     }
    
    ]) //chanel ko console log 
    if(!channel?.length){
        throw new ApiError(404,"channel does not exist think")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user= await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },{
                        $addFields:{
                            owner:{
                              $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }

    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].WatchHistory,
            "watch history fetched successfully"
        )
    )
})


export {
     registerUser,
     loginUser,
     logoutUser,
     refreshAccessToken,
     changeCurrentPassword,
     getCurrentUser,
     updateAccountDetails,
     updateUserAvatar,
     updateUserCoverImage,
     getUserChannelProfile,
     getWatchHistory
    
     };