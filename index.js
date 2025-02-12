const express = require("express");
const cors = require("cors");

require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();

const port = process.env.PORT || 5000;

//  middlewares
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://th-assignment-a87d3.web.app",
    "https://th-assignment-a87d3.firebaseapp.com",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9odt6wv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
//console.log(uri)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const petCollection = client.db("petnest").collection("pets");
    const donationCollection = client.db("petnest").collection("donations");
    const userCollection = client.db("petnest").collection("users");
    const mydonationCollection = client.db("petnest").collection("mydonations");
    const donatorCollection = client.db("petnest").collection("donators");
   
    // add mydonations
    app.post("/mydonations", async (req, res) => {
      const don = req.body;
      console.log("new pet", don);
      const result = await mydonationCollection.insertOne(don);
      res.send(result);
    });
    //get my donations 
    app.get("/don/:email", async (req, res) => {
      console.log(req.params.email);
      const query = {'donator.donatoremail': req.params.email}
      const result = await mydonationCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });


    // add pets
    app.post("/pets", async (req, res) => {
      const pet = req.body;
      console.log("new pet", pet);
      const result = await petCollection.insertOne(pet);
      res.send(result);
    });

    // add donations
    app.post("/donations", async (req, res) => {
      const donationCamp = req.body;
      console.log("new donation campaign", donationCamp);
      const result = await donationCollection.insertOne(donationCamp);
      res.send(result);
    });


    // create-payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.maxamount;
      console.log(price);
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      // generate clientSecret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // send client secret as response
      res.send({ clientSecret: client_secret });
    });

    //save user data in database
    app.put("/user", async (req, res) => {
      const user = req.body;
      // check if user already exists in db
      const isExist = await userCollection.findOne({ email: user?.email });
      if (isExist) {
        return res.send(isExist);
      }
      const options = { upsert: true };
      const query = { email: user?.email };
      //set first time
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });


    // get all users data from db
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      console.log(result);
      res.send(result);
    });

    //get users by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      console.log(result);
      res.send(result);
    });

    //update a user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //get by id for view details
    app.get("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(query);
      res.send(result);
    });

    //update add pet post
    app.put("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedpost = req.body;
      const updated = {
        $set: {
          image: updatedpost.image,
          petname: updatedpost.petname,
          age: updatedpost.age,
          category: updatedpost.category,
          location: updatedpost.location,
          shortnote: updatedpost.shortnote,
          description: updatedpost.description,
        },
      };
      const result = await petCollection.updateOne(filter, updated, options);
      res.send(result);
    });

    //email filtering
    app.get("/pet/:hostemail", async (req, res) => {
      console.log(req.params.email);
      const result = await petCollection
        .find({ hostemail: req.params.hostemail })
        .toArray();
      console.log(result);
      res.send(result);
    });


    //email filtering
    app.get("/donation/:orgemail", async (req, res) => {
      console.log(req.params.email);
      const result = await donationCollection
        .find({ orgemail: req.params.orgemail })
        .toArray();
      console.log(result);
      res.send(result);
    });


    app.delete("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.deleteOne(query);
      res.send(result);
    });

    //get all pets from db
    app.get("/pets", async (req, res) => {
      const cursor = petCollection.find();
      const result = await cursor.toArray();
      console.log(result);
      res.send(result);
    });

    // sort
    app.get("/allpets", async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      let query = {};
      if (search) {
        query = { posttitle: { $regex: search, $options: "i" } };
      }
      let sortOptions = {};
      if (sort) {
        sortOptions = { date: sort === "asce" ? 1 : -1 };
      } else {
        // Default sorting option if none is specified
        sortOptions = { date: -1 };
      }
      try {
        const result = await petCollection
          .find(query)
          .sort(sortOptions)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get all donations from db
    app.get("/donations", async (req, res) => {
      const cursor = donationCollection.find();
      const result = await cursor.toArray();
      console.log(result);
      res.send(result);
    });

    //get donations by id
    app.get("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });
    
     //update add conation campaign post
     app.put("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedpost = req.body;
      const updated = {
        $set: {
          image: updatedpost.image,
          petname: updatedpost.petname,
          age: updatedpost.age,
          category: updatedpost.category,
          location: updatedpost.location,
          shortnote: updatedpost.shortnote,
          description: updatedpost.description,
        },
      };
      const result = await donationCollection.updateOne(filter, updated, options);
      res.send(result);
    });

    // sort
    app.get("/alldonations", async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      let query = {};
      if (search) {
        query = { posttitle: { $regex: search, $options: "i" } };
      }
      let sortOptions = {};
      if (sort) {
        sortOptions = { date: sort === "asce" ? 1 : -1 };
      } else {
        // Default sorting option if none is specified
        sortOptions = { date: -1 };
      }
      try {
        const result = await donationCollection
          .find(query)
          .sort(sortOptions)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SIMPLE CRUD IS RUNNNING");
});

app.listen(port, () => {
  console.log(`simple crud is running on port:${port}`);
});
