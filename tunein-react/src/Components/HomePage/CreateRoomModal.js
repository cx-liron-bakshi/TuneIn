import { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Skeleton,
  useTheme,
} from '@mui/material';
import { useAuth } from '../../Components/AuthPage/AuthContext';
import imageCompression from 'browser-image-compression';
import { DEFAULT_ROOM_IMAGE } from '../../constants';

const CreateRoomModal = ({ open, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    genres: '', // Changed from array to comma-separated string
    imageFile: null,
    isHidden: false,
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [isImageLoading, setIsImageLoading] = useState(true); // Keep for image preview
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setIsImageLoading(true);
      setImagePreview(DEFAULT_ROOM_IMAGE);
      // Reset form fields when modal opens, ensuring defaults are set
      setFormData({
        name: '',
        genres: '',
        imageFile: null,
        isHidden: false,
      });
      setErrors({});
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsImageLoading(true);
      setFormData((prev) => ({ ...prev, imageFile: file }));
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      if (errors.imageFile) {
        setErrors(prev => ({ ...prev, imageFile: null }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Room name is required';

    const genresArray = formData.genres.split(',').map(g => g.trim()).filter(g => g);
    if (genresArray.length === 0) {
      newErrors.genres = 'At least one genre is required';
    } else if (genresArray.length > 5) {
      newErrors.genres = 'Maximum 5 genres allowed';
    }

    if (!formData.imageFile && imagePreview === DEFAULT_ROOM_IMAGE) {
      newErrors.imageFile = 'Room image is required';
    } else if (formData.imageFile && !["image/jpeg", "image/png", "image/jpg"].includes(formData.imageFile.type)) {
      newErrors.imageFile = 'Image must be in JPG or PNG format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    // Get userId from localStorage instead of relying on user object
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) {
      setErrors(prev => ({ ...prev, form: 'Authentication error. Please log in again.' }));
      return;
    }
    
    setIsSubmitting(true);

    try {
      let imageToUpload = formData.imageFile;
      if (!imageToUpload) {
        try {
          const response = await fetch(DEFAULT_ROOM_IMAGE);
          const blob = await response.blob();
          imageToUpload = new File([blob], "default-room-image.jpg", { type: blob.type });
        } catch (error) {
          setErrors(prev => ({ ...prev, imageFile: 'Failed to load default image' }));
          setIsSubmitting(false);
          return;
        }
      }

      let compressedImage = imageToUpload;
      try {
        compressedImage = await imageCompression(imageToUpload, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 400,
          useWebWorker: true,
        });
      } catch (error) {
        setErrors(prev => ({ ...prev, imageFile: 'Image compression failed' }));
        setIsSubmitting(false);
        return;
      }

      const roomData = new FormData();
      roomData.append('name', formData.name);

      const genresArray = formData.genres.split(',').map(g => g.trim()).filter(g => g);
      genresArray.forEach((genre) => {
        roomData.append('genres[]', genre);
      });

      roomData.append('isHidden', formData.isHidden);
      roomData.append('creator', userId); // Use userId from localStorage
      roomData.append('roomImage', compressedImage, compressedImage.name);

      await onSubmit(roomData);
      resetFormInternal();
    } catch (error) {
      console.error('Error creating room:', error);
      setErrors(prev => ({ ...prev, form: 'Failed to create room. Please try again.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormInternal = () => {
    setFormData({
      name: '',
      genres: '',
      imageFile: null,
      isHidden: false,
    });
    setImagePreview(DEFAULT_ROOM_IMAGE);
    setIsImageLoading(true);
    setErrors({});
  };

  const handleCancel = () => {
    resetFormInternal();
    onClose();
  };

  const handleImageLoad = () => setIsImageLoading(false);
  const handleImageError = () => {
    setIsImageLoading(false);
    if (imagePreview !== DEFAULT_ROOM_IMAGE) setImagePreview(DEFAULT_ROOM_IMAGE);
  };

  const theme = useTheme();

  return (
    <Modal open={open} onClose={isSubmitting ? undefined : handleCancel} aria-labelledby="create-room-modal">
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: 500 }, bgcolor: theme.palette.background.paper, borderRadius: 2,
        boxShadow: 24, p: 4, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <Typography variant="h5" component="h2" sx={{ mb: 3, color: theme.palette.text.primary }}>Create New Room</Typography>
        
        {/* Display form-level errors */}
        {errors.form && (
          <Typography color="error" sx={{ mb: 2 }}>
            {errors.form}
          </Typography>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal" required fullWidth id="name" label="Room Name" name="name"
            value={formData.name} onChange={handleChange} error={!!errors.name}
            helperText={errors.name} disabled={isSubmitting}
          />
          
          <TextField
            margin="normal" required fullWidth id="genres"
            label="Genres (comma-separated, max 5)" name="genres"
            value={formData.genres} onChange={handleChange} error={!!errors.genres}
            helperText={errors.genres} disabled={isSubmitting}
          />
          
          <Box sx={{ mt: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
              <Button variant="outlined" component="label" disabled={isSubmitting}>
                Upload Room Image
                <input type="file" name="imageFile" accept="image/png, image/jpeg, image/jpg" hidden onChange={handleFileChange} />
              </Button>
              {errors.imageFile && <Typography color="error" variant="caption" sx={{ml:1}}>{errors.imageFile}</Typography>}
            </Box>
            
            <Box sx={{
              display: 'flex', justifyContent: 'center', width: '100%', height: 0,
              paddingBottom: '56.25%', position: 'relative', borderRadius: 1, overflow: 'hidden',
              border: errors.imageFile ? '1px solid red' : `1px solid ${theme.palette.divider}`, 
              backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f0f0f0'
            }}>
              {isImageLoading && <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" sx={{ position: 'absolute', top: 0, left: 0 }} />}
              {imagePreview && <Box component="img" src={imagePreview} alt="Room Preview" onLoad={handleImageLoad} onError={handleImageError}
                sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: isImageLoading ? 'none' : 'block' }} />}
            </Box>
          </Box>
          
          <FormControlLabel
            control={<Switch checked={formData.isHidden} onChange={handleChange} name="isHidden" color="primary" disabled={isSubmitting} />}
            label="Make room private (won't appear in browse list)" sx={{ mt: 1, display: 'block' }}
          />
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} variant="outlined" disabled={isSubmitting} sx={{ mr: 2 }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={24} /> : 'Create Room'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateRoomModal;