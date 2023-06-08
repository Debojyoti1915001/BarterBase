const express = require('express')
const Document=require('../models/Document')
const router = express.Router()
const { contactMail } = require('../config/nodemailer');
//Route for homepage
router.get('/', async(req, res) => {
    const token=req.cookies.jwt
    const document=await Document.find({})
    var isLoggedIn=false
    if(token){
        isLoggedIn=true
    }
    res.render('./userViews/index',{
        isLoggedIn,
        document
    })
});



module.exports = router
