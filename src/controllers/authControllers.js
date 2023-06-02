const User = require('../models/User')
const Document = require('../models/Document')
const jwt = require('jsonwebtoken')
const { signupMail, passwordMail } = require('../config/nodemailer')
const path = require('path')
const { handleErrors } = require('../utilities/Utilities')
const crypto = require('crypto')
require('dotenv').config()
const { generateShortId } = require('../utilities/Utilities');

const maxAge = 30 * 24 * 60 * 60



// controller actions
module.exports.signup_get = (req, res) => {
    res.render('./userViews/signup', {
        type: 'signup',
    })
}

module.exports.login_get = (req, res) => {
    res.render('./userViews/login', {
        type: 'login',
    })
}

module.exports.signup_post = async (req, res) => {
    const { name, email, password, confirmPwd, phoneNumber } = req.body
    
    const nominee = null
    console.log('in sign up route', req.body)
    if (password != confirmPwd) {
        req.flash('error_msg', 'Passwords do not match. Try again')
        res.status(400).redirect('/user/login')
        return
    }

    try {
        const userExists = await User.findOne({ email })
        console.log('userexists', userExists)
        /*if(userExists && userExists.active== false)
    {
      req.flash("success_msg",`${userExists.name}, we have sent you a link to verify your account kindly check your mail`)

      signupMail(userExists,req.hostname,req.protocol)
      return res.redirect("/signup")
    }*/
        if (userExists) {
            req.flash(
                'success_msg',
                'This email is already registered. Try logging in'
            )
            return res.redirect('/user/login')
        }
        const short_id = generateShortId(name,phoneNumber);
        // console.log('Short ID generated is: ', short_id)
        const user = new User({
            email,
            name,
            password,
            phoneNumber,
            short_id,
            nominee,
            
        })
        let saveUser = await user.save()
        //console.log(saveUser);
        req.flash(
            'success_msg',
            'Registration successful. Check your inbox to verify your email'
        )
        signupMail(saveUser, req.hostname, req.protocol)
        //res.send(saveUser)
        res.redirect('/user/login')
    } catch (err) {
        const errors = handleErrors(err)
        console.log(errors)

        var message = 'Could not signup. '.concat(
            errors['email'] || '',
            errors['password'] || '',
            errors['phoneNumber'] || '',
            errors['name'] || ''
        )
        //res.json(errors);
        req.flash('error_msg', message)
        res.status(400).redirect('/user/signup')
    }
}
module.exports.emailVerify_get = async (req, res) => {
    try {
        const userID = req.params.id
        const expiredTokenUser = await User.findOne({ _id: userID })
        const token = req.query.tkn
        //console.log(token)
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                req.flash(
                    'error_msg',
                    ' Your verify link had expired. We have sent you another verification link'
                )
                signupMail(expiredTokenUser, req.hostname, req.protocol)
                return res.redirect('/user/login')
            }
            const user = await User.findOne({ _id: decoded.id })
            if (!user) {
                //console.log('user not found')
                res.redirect('/')
            } else {
                const activeUser = await User.findByIdAndUpdate(user._id, {
                    active: true,
                })
                if (!activeUser) {
                    // console.log('Error occured while verifying')
                    req.flash('error_msg', 'Error occured while verifying')
                    res.redirect('/')
                } else {
                    req.flash(
                        'success_msg',
                        'User has been verified and can login now'
                    )
                    //console.log('The user has been verified.')
                    //console.log('active', activeUser)
                    res.redirect('/user/login')
                }
            }
        })
    } catch (e) {
        console.log(e)
        //signupMail(user,req.hostname,req.protocol)
        res.redirect('/user/login')
    }
}

module.exports.login_post = async (req, res) => {
    const { email, password } = req.body
    // console.log('in Login route')
    // console.log('req.body',req.body)
    try {
        const user = await User.login(email, password)
        //console.log("user",user)

        const userExists = await User.findOne({ email })
        console.log("userexsits",userExists)

        if (!userExists.active) {
            const currDate = new Date()
            const initialUpdatedAt = userExists.updatedAt
            const timeDiff = Math.abs(
                currDate.getTime() - initialUpdatedAt.getTime()
            )
            if (timeDiff <= 10800000) {
                // console.log('Email already sent check it')
                req.flash(
                    'error_msg',
                    `${userExists.name}, we have already sent you a verify link please check your email`
                )
                res.redirect('/user/login')
                return
            }
            req.flash(
                'success_msg',
                `${userExists.name}, your verify link has expired we have sent you another email please check you mailbox`
            )
            signupMail(userExists, req.hostname, req.protocol)
            await User.findByIdAndUpdate(userExists._id, {
                updatedAt: new Date(),
            })
            //console.log('userExists',userExists)
            res.redirect('/user/login')
            return
        }

        const token = user.generateAuthToken(maxAge)

        res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 })
        //console.log(user);
        //signupMail(saveUser)
        // console.log("logged in")
        req.flash('success_msg', 'Successfully logged in')
        res.status(200).redirect('/user/profile')
    } catch (err) {
        req.flash('error_msg', 'Invalid Credentials')
        //console.log(err)
        res.redirect('/user/login')
    }
}

module.exports.upload_post = async (req, res) => {
    //console.log("in uploads",req.body)

    try {
        let { name } = req.body

        const files = req.files
        const dname = name.toLowerCase()
        const obj = JSON.parse(JSON.stringify(files))
        // console.log('files', obj)
        //console.log(obj.document[0].filename)
        if (Object.keys(obj).length === 0) {
            req.flash('error_msg', 'Please select atleast one file to upload')
            return res.redirect('/user/profile')
        }
        if (name === '') {
            req.flash('error_msg', 'Disease name cant be empty')
            return res.redirect('/user/profile')
        }
        const userDocument = await req.user
            .populate('document', 'name')
            .execPopulate()
        //console.log('disease',userDisease)
        
        //  console.log('disease',existName)

        const document = {
            originalName: '',
            filename: '',
        }
        
        let newDocument = await new Document({
            name,
        }).save()
        if (obj.document) {
            document.originalName = obj.document[0].originalname
            document.filename = `/uploads/${req.user.email}/${dname}/${obj.document[0].filename}`
            newDocument.document.push(document)
        }
        await newDocument.save()

        if (!newDocument) {
            req.flash('error_msg', 'Unable to save the disease details')
            return res.redirect('/user/profile')
        }
        req.user.document.push(newDocument)
        await req.user.save()

        // console.log(newDisease)
        req.flash('success_msg', 'Sucessfully uploaded document details.')
        return res.redirect('/user/profile')
    } catch (err) {
        console.log('error')
        console.error(err)
        req.flash('error_msg', 'Something went wrong')
        return res.redirect('/user/profile')
    }
}



module.exports.profile_get = async (req, res) => {
    
    res.render('./userViews/profile')
    // console.log('in profile page')
}

module.exports.logout_get = async (req, res) => {
    // res.cookie('jwt', '', { maxAge: 1 });
    // const cookie = req.cookies.jwt
    res.clearCookie('jwt')
    req.flash('success_msg', 'Successfully logged out')
    res.redirect('/user/login')
}

// module.exports.upload_get =async (req, res) => {
//   res.render("multer")
// }

module.exports.getForgotPasswordForm = async (req, res) => {
    res.render('./userViews/forgotPassword')
}

module.exports.getPasswordResetForm = async (req, res) => {
    const userID = req.params.id
    const user = await User.findOne({ _id: userID })
    const resetToken = req.params.token
    res.render('./userViews/resetPassword', {
        userID,
        resetToken,
    })
}

module.exports.forgotPassword = async (req, res) => {
    const email = req.body.email
    const user = await User.findOne({ email })
    if (!user) {
        req.flash('error_msg', 'No user found')
        return res.redirect('/user/login')
    }
    //console.log(user)
    const userID = user._id

    const dt = new Date(user.passwordResetExpires).getTime()
    if (
        (user.passwordResetToken && dt > Date.now()) ||
        !user.passwordResetToken
    ) {
        const resetToken = user.createPasswordResetToken()
        // console.log(user.passwordResetExpires)
        // console.log(user.passwordResetToken)
        await user.save({ validateBeforeSave: false })
        try {
            passwordMail(user, resetToken, req.hostname, req.protocol)
            req.flash('success_msg', 'Email sent,please check email')
            res.redirect('/user/forgotPassword')
        } catch (err) {
            user.passwordResetToken = undefined
            user.passwordResetExpires = undefined
            await user.save({ validateBeforeSave: false })
            req.flash('error_msg', 'Unable to send mail')
            res.redirect('/user/forgotPassword')
        }
    } else {
        req.flash(
            'error_msg',
            'Mail already send,please wait for sometime to send again'
        )
        res.redirect('/user/forgotPassword')
    }
}

module.exports.resetPassword = async (req, res) => {
    try {
        const token = req.params.token
        const id = req.params.id
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex')
        const user = await User.findOne({
            _id: req.params.id,
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        })
        if (!user) {
            req.flash('error_msg', 'No user found')
            return res.redirect('/user/login')
        }
        if (req.body.password !== req.body.cpassword) {
            req.flash('error_msg', 'Passwords dont match')
            return res.redirect(`resetPassword/${id}/${token}`)
        } else {
            user.password = req.body.password
            user.passwordResetToken = undefined
            user.passwordResetExpires = undefined
            await user.save()
            const JWTtoken = await user.generateAuthToken(maxAge)
            // user = user.toJSON()
            res.cookie('jwt', JWTtoken, {
                maxAge: 24 * 60 * 60 * 1000,
                httpOnly: false,
            })
            res.redirect('/user/profile')
        }
    } catch (err) {
        res.send(err)
    }
}



module.exports.picupload_post = async (req, res) => {
    const user = req.user
    const picPath = user.profilePic
    await User.findOneAndUpdate(
        { _id: user._id },
        { $set: { profilePic: picPath } },
        { new: true },
        (err, doc) => {
            if (err) {
                console.log('Something wrong when updating data!')
                req.flash('error_msg', 'Something wrong when updating data!')
                res.redirect('/user/profile')
            }

            // console.log(doc)
        }
    )
    res.redirect('/user/profile')
}




