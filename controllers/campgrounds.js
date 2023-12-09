const Campground = require('../models/campground');
const { cloudinary } = require("../cloudinary");
const opencage = require('opencage-api-client');
const { request } = require('express');
const maptoken = process.env.OPENCAGE_API_KEY

module.exports.index = async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds })
}

module.exports.renderNewForm = (req, res) => {
    res.render('campgrounds/new');
}


module.exports.createCampground = async (req, res, next) => {
    try {
        // Geocode the provided location
        const geoData = await opencage.geocode({ q: req.body.campground.location, key: maptoken });

        if (geoData.status.code === 200 && geoData.results.length > 0) {
            const place = geoData.results[0];

            // Extract relevant information from the geocoding response
            const { formatted, geometry, annotations } = place;

            // Create a new campground with the provided data
            const campgroundData = {
                ...req.body.campground,
                location: {
                    name: formatted,
                    lat: geometry.lat,
                    lng: geometry.lng
                }
            };

            const campground = new Campground(campgroundData);
            campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
            campground.author = req.user._id;

            // Save the campground to the database
            await campground.save();

            console.log(campground);
            req.flash('success', 'Successfully made a new campground!');
            res.redirect(`/campgrounds/${campground._id}`);
        } else {
            console.log('Status', geoData.status.message);
            console.log('total_results', geoData.total_results);
            // Handle geocoding failure as needed
            res.status(400).send('Invalid location');
        }
    } catch (error) {
        console.error('Error during geocoding:', error.message);
        // Handle other errors as needed
        res.status(500).send('Internal Server Error');
    }
};


module.exports.showCampground = async (req, res,) => {
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/show', { campground });
}

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id)
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });
}



module.exports.updateCampground = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(req.body);

        // Geocode the provided location
        const geoData = await opencage.geocode({ q: req.body.campground.location, key: maptoken });

        if (geoData.status.code === 200 && geoData.results.length > 0) {
            const place = geoData.results[0];

            // Extract relevant information from the geocoding response
            const { formatted, geometry } = place;

            // Update the campground data with the provided information
            const updatedCampgroundData = {
                ...req.body.campground,
                location: {
                    name: formatted,
                    lat: geometry.lat,
                    lng: geometry.lng
                }
            };

            // Find and update the campground in the database
            const campground = await Campground.findByIdAndUpdate(id, updatedCampgroundData);

            // Handle images
            const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
            campground.images.push(...imgs);
            await campground.save();

            // Handle image deletion
            if (req.body.deleteImages) {
                for (let filename of req.body.deleteImages) {
                    // Assuming cloudinary is used for image storage
                    await cloudinary.uploader.destroy(filename);
                }
                await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
            }

            req.flash('success', 'Successfully updated campground!');
            res.redirect(`/campgrounds/${campground._id}`);
        } else {
            console.log('Status', geoData.status.message);
            console.log('total_results', geoData.total_results);
            // Handle geocoding failure as needed
            req.flash('error', 'Failed to update campground. Invalid location.');
            res.redirect('back');
        }
    } catch (error) {
        console.error('Error during geocoding or campground update:', error.message);
        // Handle other errors as needed
        req.flash('error', 'Failed to update campground. Internal Server Error.');
        res.redirect('back');
    }
};


module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted campground')
    res.redirect('/campgrounds');
}