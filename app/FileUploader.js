import { useState } from "react";
import { Box, Stack, TextField, Button } from "@mui/material";

const FileUploader = () => {
    
	const [files, setFiles] = useState([]);

	const handleFileChange = ({target}) => {
		console.log(target.files[0]);
		setFiles(target.files[0]);
		console.log(`New files are: ${files}`);
	};
		
	const sendFile = async () => {
		const formData = new FormData();
		for (let i = 0; i < files.length; i++) {
			formData.append('files', files[i]);
		}
		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			})
			const result = await response.json();
			console.log('File upload successful:', result);
		} catch (error) {
			console.error('Error uploading file:', error);
		}
	};
	return (
		<Stack
        justifyContent={"center"}
        alignItems={"center"}
        direction={"row"}
        gap={5}
      >
        <Button
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
          //startIcon={<CloudUploadIcon />}
        >
          Upload file
          <input type="file" hidden onChange={(e) => handleFileChange(e)} />
        </Button>
        {files.length !== 0 ?
          <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            onClick={sendFile}
          >
            Train Model on Files(s)
          </Button> : ""
        }
      </Stack>
	);
}

export default FileUploader;