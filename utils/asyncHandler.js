const asyncHandler = (requestHandler) => {
	(req, res, next) => {
		Promoise.resolve(requestHandler(req, res, next)).catach((err) =>
			next(err)
		);
	};
};
 

// const asyncHandler = (fn) =>  async(req, res, next) 
//  => 
//     try{
//         await fn(req, res, next)
//     }
//     catch(error){
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
