import { Router } from 'express';
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {getAllVideos,publishAVideo,getVideoById,updateVideo,deleteVideo,togglePublishStatus} from "../controllers/video.controller.js"
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();
console.log('reach till routerroute')
router.route("/publish-a-video")
    .get(getAllVideos)
    .post(verifyJWT,upload.fields([

          {
                name: "videoFile",
                maxCount: 1
            },
            {
                name: "thumbnail",
                maxCount: 1
            },
            
    ]),
     publishAVideo)

router
    .route("/:videoId")
    .get(getVideoById)
    .delete(verifyJWT, deleteVideo)
     .patch(verifyJWT, upload.single("thumbnail"), updateVideo)
     ;  //multer middleware thumbnail ko temperory local storage me save
  router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);


    export default router