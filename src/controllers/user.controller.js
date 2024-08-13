import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/fileUpload.js";
import { fileDestroy } from "../../utils/fileDestroy.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
	try {
		let user = await User.findById(userId);
		const accessToken = user.generateAccessToken();
		const refreshToken = user.generateRefreshToken();

		console.log("In Function: \n");

		console.log(refreshToken);

		user.refreshToken = refreshToken;
		user = await user.save({ validateBeforeSave: false });

		console.log(user.refreshToken);

		console.log(user);

		return { accessToken, refreshToken };
	} catch (error) {
		console.log(error);
		throw new ApiError(500, "Something went wrong while generating tokens");
	}
};

const registerUser = asyncHandler(async (req, res) => {
	// get user details from frontend
	// validation - not empty
	// check if user already exists: username, email
	// check for images, check for avatar
	// upload them to cloudinary, avatar
	// create user object - create entry in db
	// remove password and refresh token field from response
	// check for user creation
	// return response

	console.log("req.body\n", req.body); //**IMPORTANT**

	const { email, username, password, fullname } = req.body;

	if (!fullname || !email || !username || !password) {
		throw new ApiError(400, "All fields are required!");
	}

	const existedUser = await User.findOne({
		$or: [{ username }, { email }],
	});

	// console.log("Existed User : \n", existedUser);

	if (existedUser)
		throw new ApiError(409, "User with email or username already exists");

	const avatarLocalPath = req.files?.avatar?.[0]?.path;

	// const coverImageLocalPath = req.files?.coverImage[0]?.path;

	console.log("req.files: \n", req.files);

	let coverImageLocalPath;
	if (
		req.files &&
		Array.isArray(req.files.coverImage) &&
		req.files.coverImage.length > 0
	) {
		coverImageLocalPath = req.files.coverImage[0].path;
	}
	// console.log(req.files) **IMPORTANT**

	if (!avatarLocalPath) {
		throw new ApiError(400, "Avatar files is required!");
	}

	if (!coverImageLocalPath) {
		throw new ApiError(400, "Cover image file is required!");
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath);
	console.log(avatar.url);
	console.log(avatar.public_id);
	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	if (!avatar) throw new ApiError(400, "Avatar file is required!");

	const user = await User.create({
		fullname,
		avatar: avatar.url,
		coverImage: coverImage?.url || "",
		email,
		password,
		username: username.toLowerCase(),
	});

	const createdUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);
	console.log(createdUser);

	if (!createdUser)
		throw new ApiError(
			500,
			"Something went Wrong while registering a user"
		);

	return res
		.status(201)
		.json(new ApiResponse(200, createdUser, "User Registered Succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
	// req.body -> data
	// check for username or email
	// find the user
	// check for password
	// generate accesToken and refreshToken
	// save token in db
	// return token in Cookies
	// return response

	const { username, email, password } = req.body;

	console.log(req.body);

	if (!email) throw new ApiError(400, "username or password is required!");

	const user = await User.findOne({
		$or: [{ username }, { email }],
	});

	if (!user) throw new ApiError(404, "User does not exist!");

	const isPasswordValid = await user.comparePassword(password);

	if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials!");

	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	const loggedInUser = await User.findById(User._id).select(
		"-password -refreshToken"
	);

	const options = {
		httpOnly: true,
		secure: true,
	};

	return res
		.status(200)
		.cookie("accessToken", accessToken, options)
		.cookie("refreshToken", refreshToken, options)
		.json(
			new ApiResponse(
				200,
				{ user: loggedInUser, accessToken, refreshToken },
				"User logged in Succssfully!"
			)
		);
});

const logoutUser = asyncHandler(async (req, res) => {
	await User.findByIdAndUpdate(
		req.user._id,
		{
			$set: { refreshToken: undefined },
		},
		{
			new: true,
		}
	);
	const options = {
		httpOnly: true,
		secure: true,
	};

	return res
		.status(200)
		.clearCookie("accessToken", options)
		.clearCookie("refreshToken", options)
		.json(new ApiResponse(200, {}, "User logged out Succssfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
	const incomingRefreshToken =
		req.cookies.refreshToken || req.body.generateRefreshToken;

	if (!incomingRefreshToken) {
		throw new ApiError(401, "Unauthorized Request!");
	}

	try {
		const decodedToken = jwt.verify(
			incomingRefreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);

		const user = await User.findById(decodedToken?._id);

		if (!user) {
			throw new ApiError(401, "Invalid Refresh Token!");
		}

		console.log("Incoming Refresh: \n", incomingRefreshToken);

		console.log("User.refreshToken: ", user.refreshToken);

		if (incomingRefreshToken !== user?.refreshToken) {
			throw new ApiError(401, "Refresh token is expired or used!");
		}
		const { accessToken, newRefreshToken } =
			await generateAccessAndRefreshTokens(user._id);

		const options = {
			httpOnly: true,
			secure: true,
		};

		return res
			.status(200)
			.cookie("accessToken", accessToken, options)
			.cookie("refreshToken", newRefreshToken, options)
			.json(
				new ApiResponse(
					200,
					{ accessToken, refreshToken: newRefreshToken },
					"Access token refreshed!"
				)
			);
	} catch (error) {
		throw new ApiError(401, error);
	}
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	const user = await User.findById(req.user._id);

	const isPasswordValid = await user.comparePassword(oldPassword);

	if (!isPasswordValid) {
		throw new ApiError(401, "Invalid Old Password!");
	}

	user.password = newPassword;
	await user.save({ validateBeforeSave: false });

	return res
		.status(200)
		.json(new ApiResponse(200, {}, "Password changed successfully!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
	return res
		.status(200)
		.json(200, req.user, "current user fetched successfully!");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
	const { fullname, email } = req.body;

	if (!fullname || !email) {
		throw new ApiError(400, "All fields are required!");
	}

	const user = await User.findByIdAndDelete(
		req.user?._id,
		{ $set: { fullname, email } },
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(
			new ApiResponse(200, user, "Account Details updated Successfully!")
		);
});

const updateUserAvatar = asyncHandler(async (req, res) => {
	const avatarURL = req.user.avatar;

	const newAvatarLocalPath = req.file?.path;

	console.log(newAvatarLocalPath);

	if (!newAvatarLocalPath) {
		throw new ApiError(400, "Avatar file is missing!");
	}

	const newAvatar = await uploadOnCloudinary(newAvatarLocalPath);

	if (!newAvatar.url) {
		throw new ApiError(500, "Something went wrong while uploading avatar!");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{ $set: { avatar: newAvatar.url } },
		{ new: true }
	).select("-password");

	await fileDestroy(avatarURL);

	return res
		.status(200)
		.json(new ApiResponse(200, user, "Avatar updated Successfully!"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
	const coverImageLocalPath = req.file?.path;

	if (!coverImageLocalPath) {
		throw new ApiError(400, "CoverImage file is missing!");
	}

	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	if (!coverImage.url) {
		throw new ApiError(500, "Something went wrong while uploading avatar!");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{ $set: { coverImage: coverImage.url } },
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, user, "Cover Image updated Successfully!"));
});

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
};
