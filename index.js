const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gflzo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('booking');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
        });
        // this is not the proper way to  query.
        //After learning more about mongodb . use aggrreegrate lookup pipeline match group
        app.get('/available', async (req, res) => {
            const data = req.query.data;
            //step 1: get all services

            const service = await serviceCollection.find().toArray();
            //step: 2 get the booking off the day

            const query = { date: data };
            const bookings = await bookingCollection.find(query).toArray();
            // step 3: for ech  service , find booking for  that service

            service.forEach(service => {
                // step: 4 find booking for the server

                const serviceBooking = bookings.filter(book => book.treatment === service.name);
                // step: 5 select slots for the bookings:['', '', '',]

                const bookedSlots = serviceBooking.map(book => book.slot)
                // step: 6 select those slots thst sre not  in bookedslots
                
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(service)
        })
        app.get('/booking', async(req, res) =>{
            const patient = req.query.patient;
            const query ={patient: patient};
            const booking = await bookingCollection.find(query).toArray();
            res.send(booking)
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result });
        })
    }
    finally {

    }


}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello Doctor Uncle!')
})

app.listen(port, () => {
    console.log(`Doctor  app listening on port ${port}`)
})