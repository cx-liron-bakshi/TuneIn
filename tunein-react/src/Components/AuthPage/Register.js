import { useState } from "react";
import axios from "axios";
import imageCompression from "browser-image-compression";
import { 
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Avatar,
  CircularProgress 
} from '@mui/material';
import { useNavigate } from "react-router-dom";
import { DEFAULT_PROFILE_IMAGE } from "../../constants";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    nickname: "",
    genres: "",
    password: "",
    retypePassword: "",
    profilePic: null,
  });
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Set default preview to the default profile pic path
  const [profilePicPreview, setProfilePicPreview] = useState(DEFAULT_PROFILE_IMAGE);

  // Helper to check if genres are comma separated
  const isGenresValid = (genres) => {
    if (!genres) return false;
    const arr = genres.split(",").map(g => g.trim()).filter(Boolean);
    return arr.length > 0 && (arr.length === 1 || genres.includes(","));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((prev) => ({
        ...prev,
        profilePic: file,
      }));
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setIsLoading(true);

    // 1. Password validation
    if (form.password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }
    
    if (form.password !== form.retypePassword) {
      setMsg("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    // 2. Genres validation
    if (!isGenresValid(form.genres)) {
      setMsg("Genres must be comma separated (e.g., Rock, Pop, Jazz).");
      setIsLoading(false);
      return;
    }

    // 3. Profile pic validation
    let profilePicFile = form.profilePic;
    if (!profilePicFile) {
      // Fetch the default image from public folder
      try {
        const response = await fetch(DEFAULT_PROFILE_IMAGE);
        const blob = await response.blob();
        profilePicFile = new File([blob], "blank-profile-picture.png", { type: blob.type });
      } catch {
        setMsg("Failed to load default profile picture.");
        setIsLoading(false);
        return;
      }
    } else if (!["image/jpeg", "image/png"].includes(profilePicFile.type)) {
      setMsg("Profile picture must be a .jpg or .png file.");
      setIsLoading(false);
      return;
    }

    // Compress image
    let compressedPic = profilePicFile;
    try {
      compressedPic = await imageCompression(profilePicFile, {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 640,
        useWebWorker: true,
      });
    } catch {
      setMsg("Image compression failed");
      setIsLoading(false);
      return;
    }

    // Prepare form data
    const data = new FormData();
    data.append("email", form.email);
    data.append("nickname", form.nickname);
    data.append("genres", form.genres);
    data.append("password", form.password);
    data.append("profilePic", compressedPic, compressedPic.name);
    data.append("retypePassword", form.retypePassword);
    // email, nickname, password, retypePassword, genres


    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/register`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      setMsg("Registration successful!");
      
      // If the backend returns a token upon registration, store it
      if (response.data.token) {
        localStorage.setItem("authToken", response.data.token);
        if (response.data.userId) {
          localStorage.setItem("userId", response.data.userId);
        }
        
        // Short timeout to show the success message
        setTimeout(() => {
          navigate("/home");
        }, 1500);
      }
    } catch (err) {
      setMsg(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        fullWidth
        label="Email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        required
        disabled={isLoading}
      />
      
      <TextField
        fullWidth
        label="Nickname"
        name="nickname"
        value={form.nickname}
        onChange={handleChange}
        required
        disabled={isLoading}
      />
      
      <TextField
        fullWidth
        label="Genres (comma separated)"
        name="genres"
        placeholder="Rock, Pop, Jazz"
        value={form.genres}
        onChange={handleChange}
        helperText="Example: Rock, Pop, Jazz (max 5)"
        required
        disabled={isLoading}
      />
      
      <TextField
        fullWidth
        label="Password"
        name="password"
        type="password"
        value={form.password}
        onChange={handleChange}
        required
        disabled={isLoading}
      />
      
      <TextField
        fullWidth
        label="Retype Password"
        name="retypePassword"
        type="password"
        value={form.retypePassword}
        onChange={handleChange}
        required
        disabled={isLoading}
      />
      
      <Box>
        <Button
          variant="outlined"
          component="label"
          sx={{ mb: 2 }}
          disabled={isLoading}
        >
          Upload Profile Picture
          <input
            type="file"
            name="profilePic"
            accept="image/png, image/jpeg"
            hidden
            onChange={handleFileChange}
          />
        </Button>
        
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Avatar
            src={profilePicPreview}
            alt="Profile Preview"
            sx={{ width: 100, height: 100 }}
          />
        </Box>
      </Box>
      
      <Button 
        fullWidth 
        variant="contained" 
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? <CircularProgress size={24} color="inherit" /> : "Register"}
      </Button>
      
      {msg && (
        <Alert severity={msg.includes("successful") ? "success" : "error"}>
          {msg}
        </Alert>
      )}
    </Box>
  );
}