import dotenv from "dotenv";
import connectDB from "./db/index.js";
dotenv.config({ path: "./env" });

connectDB()
	.then(() => {
		app.on("ERROR", (error) => {
			console.log("Server execution is failed!", error);
			throw error;
		});
		app.listen(process.env.PORT || 8000, () => {
			console.log(`Server is running at port : ${process.env.PORT}`);
		});
	})
	.catch((err) => {
		console.log("Mongo DB connection failed!! ", err);
	});
