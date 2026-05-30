import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || 'mongodb://localhost:27017/realestate';

const patnaLocations = [
  'Danapur-Khagaul Road, Near Saguna More',
  'Patliputra Colony, Boring Road Lane',
  'Bihta, Near IIT Patna Campus',
  'Bailey Road, Near Gola Road Crossing',
  'Ashiana Nagar, Phase 1',
  'Kankarbagh, Near Shivaji Park',
  'Rajendra Nagar, Near Stadium Road',
  'Exhibition Road, Near Gandhi Maidan',
  'Anisabad, Near Police Colony',
  'Digha, Near JP Setu Corridor'
];

const delhiLocations = [
  'Moti Nagar, Shivaji Marg',
  'Karol Bagh, Padam Singh Road',
  'Saket, Near Select CityWalk',
  'Vasant Kunj, Sector B',
  'Dwarka Sector 10, Near Metro Station',
  'Rohini Sector 9, Avantika Road',
  'Greater Kailash 1, M Block Market',
  'Lajpat Nagar 2, Central Market Road',
  'Janakpuri, District Centre Block',
  'Connaught Place, Inner Circle Outer Ring'
];

const mumbaiLocations = [
  'Lower Parel, Senapati Bapat Marg',
  'Powai, Near Hiranandani Gardens',
  'Andheri West, Lokhandwala Complex',
  'Bandra West, Linking Road Lane',
  'Juhu, Near Tara Road Beachside',
  'Worli, Sea Face Boulevard',
  'Thane West, Ghodbunder Road',
  'Wadala East, Near Bhakti Park',
  'Ghatkopar East, Near Station Road',
  'Malad West, Near Mindspace IT Hub'
];

const bangaloreLocations = [
  'Whitefield, Near ITPL Main Road',
  'Indiranagar, 100 Feet Road Lane',
  'Koramangala 4th Block, Near Wipro Park',
  'HSR Layout Sector 2, Near Outer Ring Road',
  'Electronic City Phase 1, Wipro Gate',
  'JP Nagar 2nd Phase, Near Ranga Shankara',
  'Marathahalli, Near Multiplex Road',
  'Yelahanka New Town, Near Sector B',
  'Jayanagar 4th Block, Near Shopping Complex',
  'Hebbal, Near Flyover Outer Corridor'
];

const flatPhotos = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b'
];

const villaPhotos = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d'
];

const plotPhotos = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8'
];

const commercialPhotos = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab',
  'https://images.unsplash.com/photo-1497366216548-37526070297c',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174'
];

const descriptions = {
  Flat: [
    'Premium modular kitchen, elegant false ceiling design, 24/7 water supply, gated community structure with high-security guards.',
    'Breathtaking balcony views, premium Italian vitrified tiles, dedicated parking slot, and walking distance to transit hubs.',
    'Modern structure with children park access, swimming pool, power backup generator, and excellent internal ventilation.'
  ],
  Villa: [
    'Independent double storey duplex with a lush private front garden, spacious open terrace, and private car garage for 2 SUVs.',
    'Ultra luxury smart-villa with custom lighting controls, marble pillars, servant quarters, and high privacy boundary walls.',
    'Elegant styling, spacious walk-in closets, wooden flooring master bedroom, and highly serene peaceful elite locality.'
  ],
  Plot: [
    'Fully cleared freehold corner plot, pre-constructed high brick boundary walls, excellent road frontage size of 40 ft.',
    'High potential investment land inside rapidly growing industrial/educational zone, perfect for long-term equity growth.',
    'Posh residential colony plot ready for immediate construction with government water connection approval.'
  ],
  Commercial: [
    'Fully furnished ground floor showroom situated in a highly popular market street with huge daily pedestrian footfall.',
    'Modern co-working office cabin setup with server room, central air conditioning, elevator lift access, and fire safety systems.',
    'Multi-utility warehouse or retail showroom space, tall shutter doors, massive loading bay area, and prominent highway view.'
  ]
};

async function main() {
  console.log(`Connecting directly to MongoDB at ${url} ...`);
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db();

  console.log('Clearing database tables...');
  await db.collection('Visit').deleteMany({});
  await db.collection('Property').deleteMany({});
  await db.collection('Lead').deleteMany({});
  await db.collection('Agent').deleteMany({});

  console.log('Seeding Agents...');
  const agents = [
    {
      _id: new ObjectId(),
      name: 'Ashish Kumar',
      phone: '+919876543210',
      telegramChatId: '123456789',
      isActive: true
    },
    {
      _id: new ObjectId(),
      name: 'Rohit Sharma',
      phone: '+918765432109',
      telegramChatId: '987654321',
      isActive: true
    }
  ];
  await db.collection('Agent').insertMany(agents);

  console.log('Generating 50 premium property items...');
  const properties: any[] = [];

  const cities = [
    { name: 'Patna', locations: patnaLocations, count: 15 },
    { name: 'Delhi', locations: delhiLocations, count: 12 },
    { name: 'Mumbai', locations: mumbaiLocations, count: 12 },
    { name: 'Bangalore', locations: bangaloreLocations, count: 11 }
  ];

  const types = ['Flat', 'Villa', 'Plot', 'Commercial'];

  let propCounter = 1;

  for (const city of cities) {
    for (let i = 0; i < city.count; i++) {
      const type = types[i % types.length] as 'Flat' | 'Villa' | 'Plot' | 'Commercial';
      const location = city.locations[i % city.locations.length];
      
      // Compute specific specs
      let price = 0;
      let bhk: number | null = null;
      let areaSqFt = 0;
      let photosList: string[] = [];

      if (type === 'Flat') {
        bhk = (i % 3) + 1; // 1, 2, 3 BHK
        price = bhk === 1 ? 35 + (i * 2) : bhk === 2 ? 65 + (i * 3) : 95 + (i * 4);
        areaSqFt = bhk * 600 + (i * 20);
        photosList = [flatPhotos[i % flatPhotos.length], flatPhotos[(i + 1) % flatPhotos.length]];
      } else if (type === 'Villa') {
        bhk = (i % 2) + 3; // 3, 4 BHK Duplex
        price = bhk === 3 ? 120 + (i * 5) : 180 + (i * 7);
        areaSqFt = bhk * 800 + (i * 30);
        photosList = [villaPhotos[i % villaPhotos.length], villaPhotos[(i + 1) % villaPhotos.length]];
      } else if (type === 'Plot') {
        price = 25 + (i * 3);
        areaSqFt = 1200 + (i * 100);
        photosList = [plotPhotos[i % plotPhotos.length]];
      } else if (type === 'Commercial') {
        price = 150 + (i * 15);
        areaSqFt = 800 + (i * 150);
        photosList = [commercialPhotos[i % commercialPhotos.length], commercialPhotos[(i + 1) % commercialPhotos.length]];
      }

      const descPool = descriptions[type];
      const desc = descPool[i % descPool.length];

      const prefix = city.name === 'Patna' ? 'Maurya' : city.name === 'Delhi' ? 'Capital' : city.name === 'Mumbai' ? 'Royal' : 'Signature';
      const suffix = type === 'Flat' ? 'Residency' : type === 'Villa' ? 'Duplex Villas' : type === 'Plot' ? 'Meadows Land' : 'Plaza Hub';

      let amenitiesList: string[] = [];
      if (type === 'Flat') {
        amenitiesList = ['Modular Kitchen 🍳', 'Gated Community 🛡️', '24/7 Power Backup ⚡', 'Intercom & CCTV 📹', 'Club House Access 🏊‍♂️'];
      } else if (type === 'Villa') {
        amenitiesList = ['Private Backyard Garden 🏡', 'Smart Automation Systems 📱', 'Dedicated Servant Quarter 🧑‍💼', 'Private Parking Space 🚗', 'Modular Wardrobes 🚪'];
      } else if (type === 'Plot') {
        amenitiesList = ['Freehold Registry 📜', 'Pre-constructed Boundary Wall 🧱', 'Water Borewell Pipe Connection 🚰', 'Tall Gate Entry 🚪'];
      } else if (type === 'Commercial') {
        amenitiesList = ['High-Speed Elevators 🛗', 'Centralized Air Conditioning ❄️', 'Visitor Waiting Lounge 🛋️', 'Fire Hydrant & Alarm Systems 🚨', 'Dual Shutter Entry 🚪'];
      }

      const nearbyList = [
        `Local Transit Station (500 meters) 🚇`,
        `${prefix} High School & Academy (1.5 km) 🏫`,
        `Multispecialty Care Center (1.0 km) 🏥`,
        `Shopping Plaza & Cinema (1.2 km) 🛍️`
      ];

      const floorPlanText = type === 'Flat'
        ? `Typical ${bhk} BHK Floor Layout with spacious balconies and modular partitions.`
        : type === 'Villa'
          ? `Exclusive ${bhk} BHK Duplex Layout featuring private terrace and private gardens.`
          : type === 'Plot'
            ? `Cleared boundary plot measuring ${areaSqFt} sq.ft. ready for direct layout development.`
            : `Premium high-street double shutter showroom with modular mezzanine office layout.`;

      properties.push({
        _id: new ObjectId(),
        title: `${prefix} ${type} ${propCounter} (${suffix})`,
        location: location,
        city: city.name,
        price: price,
        type: type,
        bhk: bhk,
        areaSqFt: areaSqFt,
        description: `${desc} Situated in the prime zone of ${location}, ${city.name}. Built with top-grade construction standards.`,
        photos: photosList,
        brochureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        amenities: amenitiesList,
        developer: `${prefix} Infra & Housing Ltd.`,
        floorPlan: floorPlanText,
        nearbyPlaces: nearbyList,
        latitude: 25.59 + (i * 0.005),
        longitude: 85.04 + (i * 0.005),
        createdAt: new Date()
      });

      propCounter++;
    }
  }

  await db.collection('Property').insertMany(properties);

  console.log('Seeding completed successfully!');
  const agentCount = await db.collection('Agent').countDocuments();
  const propertyCount = await db.collection('Property').countDocuments();
  console.log(`Created ${agentCount} agents and exactly ${propertyCount} properties.`);

  await client.close();
}

main().catch((err) => {
  console.error('Seeding process encountered an error:', err);
  process.exit(1);
});
