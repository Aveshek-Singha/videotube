import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const fileDestroy = async (avatarUrl) => {
	try {
		// Extract the public_id from the URL
		const urlParts = avatarUrl.split("/");
		const fileName = urlParts[urlParts.length - 1];
		const publicId = fileName.split(".")[0]; // Assuming the public_id is before the file extension

		// Delete the file from Cloudinary using the public_id
		const deleteResponse = await cloudinary.uploader.destroy(publicId, {
			resource_type: "image",
		});

		console.log(
			"File deleted successfully from Cloudinary:",
			deleteResponse
		);
	} catch (error) {
		console.error("Error during deletion:", error);
	}
};
