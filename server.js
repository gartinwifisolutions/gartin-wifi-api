require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://gartinwifisolutions.com', 'http://localhost:8080', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true
}));
app.use(express.json());

// Basic security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// MongoDB connection with retry logic
const connectDB = async () => {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('Connected to MongoDB');
            return;
        } catch (err) {
            retries++;
            console.error(`MongoDB connection attempt ${retries} failed:`, err);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
        }
    }
    throw new Error('Failed to connect to MongoDB after multiple retries');
};

connectDB().catch(err => {
    console.error('Fatal MongoDB connection error:', err);
    process.exit(1);
});

// Review Schema
const reviewSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxLength: 100
    },
    rating: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 5 
    },
    review: { 
        type: String, 
        required: true,
        trim: true,
        maxLength: 1000
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    approved: { 
        type: Boolean, 
        default: true 
    }
});

const Review = mongoose.model('Review', reviewSchema);

// Public Routes
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find()
            .sort({ date: -1 })
            .select('-__v')
            .lean();
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ error: 'Error fetching reviews' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { name, rating, review } = req.body;

        // Validate input
        if (!name || !rating || !review) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const newReview = new Review({
            name: name.trim(),
            rating,
            review: review.trim(),
            approved: true 
        });

        await newReview.save();
        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (err) {
        console.error('Error submitting review:', err);
        res.status(400).json({ error: 'Error submitting review' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
