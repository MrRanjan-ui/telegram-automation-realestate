import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as https from 'https';

/**
 * Helper to format currency in Rupees
 */
function formatPrice(lakhs: number): string {
  if (lakhs >= 100) {
    return `Rs. ${(lakhs / 100).toFixed(2)} Crore`;
  }
  return `Rs. ${lakhs} Lakhs`;
}

/**
 * Robust HTTPS client to download remote Unsplash property images into local buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: status code ${res.statusCode}`));
        return;
      }
      const chunks: any[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}

/**
 * Dynamically generates a highly premium, clean 3-page PDF Brochure for a Property.
 * - Sets autoPageBreak: false to prevent accidental page creations due to margin limits.
 * - Removes all non-standard emojis to guarantee crisp, error-free vector typography.
 * - Dynamically downloads and renders the primary property listing photo in high resolution on the cover.
 */
export async function generatePropertyBrochure(property: any, outputPath: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF Document with autoPageBreak: false and zero margins for absolute layout control
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 0, 
        autoPageBreak: false 
      } as any);
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ==========================================
      // PAGE 1: LUXURY COVER PAGE
      // ==========================================
      // Deep Slate Background
      doc.rect(0, 0, 595.28, 841.89).fill('#0f172a');

      // Decorative Gold/Amber Accents
      doc.rect(40, 40, 5, 761.89).fill('#d97706'); // Side Gold vertical bar
      doc.rect(40, 40, 515.28, 5).fill('#d97706'); // Top Gold bar

      // Watermark/Subtle background text
      doc.fillColor('#1e293b').fontSize(72).font('Helvetica-Bold');
      doc.fillOpacity(0.1);
      doc.text('AARNA', 70, 100);
      doc.text('ESTATES', 70, 170);
      doc.fillOpacity(1.0); // Reset opacity for main text

      // Brand Logo Header
      doc.fillColor('#f8fafc').fontSize(18).font('Helvetica-Bold');
      doc.text('AARNA ESTATES AI', 70, 70);
      doc.fillColor('#d97706').fontSize(10).font('Helvetica');
      doc.text('PREMIUM INDIAN REAL ESTATE PLATFORM', 70, 92);

      // --- DYNAMIC PROPERTY IMAGE CARD (PAGE 1) ---
      const photos = property.photos || [];
      if (photos.length > 0) {
        try {
          const imageBuffer = await fetchImageBuffer(photos[0]);
          
          // Draw image placeholder borders
          doc.rect(70, 125, 450, 190).fill('#1e293b');
          doc.image(imageBuffer, 72, 127, { width: 446, height: 186, fit: [446, 186], align: 'center', valign: 'center' });
          
          // Outer Gold image thin frame
          doc.rect(70, 125, 450, 190).strokeColor('#d97706').lineWidth(1.5).stroke();
        } catch (imgError) {
          console.error('[Brochure Image Fetch Failed] Rendering dark placeholder:', imgError);
          // Fallback box if image download fails
          doc.rect(70, 125, 450, 190).fill('#1e293b');
          doc.rect(70, 125, 450, 190).strokeColor('#d97706').lineWidth(1.5).stroke();
          doc.fillColor('#cbd5e1').fontSize(12).font('Helvetica-Bold');
          doc.text('PREMIUM PROPERTY VISUAL PORTFOLIO', 170, 215);
        }
      } else {
        // Fallback placeholder box
        doc.rect(70, 125, 450, 190).fill('#1e293b');
        doc.rect(70, 125, 450, 190).strokeColor('#d97706').lineWidth(1.5).stroke();
        doc.fillColor('#cbd5e1').fontSize(12).font('Helvetica-Bold');
        doc.text('PREMIUM PROPERTY VISUAL PORTFOLIO', 170, 215);
      }

      // Property Title Section
      doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold');
      doc.text(property.title || 'Elite Residency', 70, 340, { width: 440, lineGap: 6 });

      doc.rect(70, 420, 180, 4).fill('#d97706'); // Gold underline spacer

      // Specifications (Clean, Emoji-Free to avoid garbled symbols)
      doc.fillColor('#cbd5e1').fontSize(12).font('Helvetica-Bold');
      doc.text(`Location: ${property.location}, ${property.city}`, 70, 445);
      doc.text(`Pricing: ${formatPrice(property.price)}`, 70, 470);
      doc.text(`Category: ${property.type}${property.bhk ? ` | ${property.bhk} BHK` : ''}`, 70, 495);
      doc.text(`Area: ${property.areaSqFt} Sq.Ft.`, 70, 520);

      // Footer Cover Details
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica');
      doc.text('DEVELOPER', 70, 680);
      doc.fillColor('#f8fafc').fontSize(14).font('Helvetica-Bold');
      doc.text(property.developer || 'Aarna Constructions Ltd.', 70, 695);

      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica');
      doc.text('Generated Dynamically via Aarna Real Estate Telegram Automation Platform - 2026', 70, 760);

      // ==========================================
      // PAGE 2: DETAILED SPECS & BLUEPRINT
      // ==========================================
      doc.addPage({ size: 'A4', margin: 0 });

      // White Page Background
      doc.rect(0, 0, 595.28, 841.89).fill('#ffffff');

      // Header Top Navy Banner
      doc.rect(0, 0, 595.28, 45).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
      doc.text(property.title.toUpperCase(), 40, 18, { align: 'left' });
      doc.text('PROPERTY DETAILS & SPECIFICATIONS', 40, 18, { align: 'right' });

      // Left Column - Overview & Description
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold');
      doc.text('Overview & Description', 40, 75);
      doc.rect(40, 97, 230, 2).fill('#d97706');

      doc.fillColor('#334155').fontSize(9.5).font('Helvetica').lineGap(4);
      doc.text(property.description || 'No description provided.', 40, 110, { width: 230, align: 'justify' });

      // Premium Amenities List (Emoji-Free Clean text)
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold');
      doc.text('Premium Amenities', 40, 260);
      doc.rect(40, 278, 230, 1).fill('#cbd5e1');

      const rawAmenities: string[] = property.amenities || [
        'Swimming Pool Access',
        '24/7 Gated Security',
        'Fully-Equipped Gym',
        'Modular Kitchen Fittings',
        'Dedicated Car Parking Slot',
        'Full Power Backup Generator'
      ];

      // Remove any emojis just in case
      const cleanAmenities = rawAmenities.map(a => a.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim());

      doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold');
      let yOffset = 295;
      for (const item of cleanAmenities) {
        doc.text(`*  ${item}`, 50, yOffset);
        yOffset += 18;
      }

      // Right Column - Blueprint/Floor Plan Vector Box
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold');
      doc.text('Floor Plan Layout Blueprint', 310, 75);
      doc.rect(310, 97, 245, 2).fill('#d97706');

      // Draw vector Floor Plan Box (Architectural blueprint)
      const bpX = 310;
      const bpY = 110;
      const bpW = 245;
      const bpH = 220;

      // Blueprint Grid
      doc.rect(bpX, bpY, bpW, bpH).fill('#f8fafc');
      doc.rect(bpX, bpY, bpW, bpH).strokeColor('#cbd5e1').lineWidth(1).stroke();

      // Grid watermark lines
      doc.strokeColor('#f1f5f9').lineWidth(0.5);
      for (let g = bpX + 20; g < bpX + bpW; g += 20) {
        doc.moveTo(g, bpY).lineTo(g, bpY + bpH).stroke();
      }
      for (let g = bpY + 20; g < bpY + bpH; g += 20) {
        doc.moveTo(bpX, g).lineTo(bpX + bpW, g).stroke();
      }

      // Draw Mock Rooms (Vectors)
      doc.strokeColor('#475569').lineWidth(2);
      
      // Living Area
      doc.rect(bpX + 20, bpY + 20, 100, 100).stroke();
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      doc.text('LIVING ROOM\n16\' x 14\'', bpX + 30, bpY + 50);

      // Bed Room 1
      doc.rect(bpX + 130, bpY + 20, 95, 90).stroke();
      doc.text('BEDROOM 1\n12\' x 11\'', bpX + 140, bpY + 50);

      // Bed Room 2
      doc.rect(bpX + 20, bpY + 130, 95, 70).stroke();
      doc.text('BEDROOM 2\n12\' x 10\'', bpX + 30, bpY + 150);

      // Modular Kitchen
      doc.rect(bpX + 125, bpY + 120, 100, 80).stroke();
      doc.text('KITCHEN\n10\' x 8\'', bpX + 145, bpY + 150);

      // Blueprint notes (Clean)
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').lineGap(2);
      const planNote = property.floorPlan || 'Typical Residential Floor Layout. Dimensions shown represent carpet area boundary configurations.';
      const cleanPlanNote = planNote.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
      doc.text(cleanPlanNote, 310, 345, { width: 245, align: 'justify' });

      // Technical Specs Table Separator
      doc.rect(40, 440, 515, 30).fill('#f1f5f9');
      doc.rect(40, 440, 515, 30).strokeColor('#cbd5e1').lineWidth(1).stroke();
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
      doc.text('DETAILED TECHNICAL SPECIFICATIONS', 50, 451);

      // Specs Table Rows (Clean)
      const specs = [
        { label: 'Foundation', val: 'Earthquake resistant RCC Framed structure' },
        { label: 'Flooring', val: 'Premium Vitrified Tiles / Italian Marble in foyer' },
        { label: 'Kitchen Fittings', val: 'Granite counter top, stainless steel double sink' },
        { label: 'Power Backup', val: '100% Automatic Generator backup in common areas' },
        { label: 'Water Supply', val: 'Dual Borewell and Municipal supply with softeners' },
        { label: 'Security System', val: 'IP CCTV cameras with Video door phone integration' }
      ];

      let tableY = 485;
      doc.fontSize(8.5);
      for (const spec of specs) {
        doc.fillColor('#475569').font('Helvetica-Bold');
        doc.text(spec.label, 45, tableY, { width: 140 });
        doc.fillColor('#0f172a').font('Helvetica');
        doc.text(`:   ${spec.val}`, 180, tableY, { width: 370 });
        doc.moveTo(40, tableY + 14).lineTo(555, tableY + 14).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        tableY += 19;
      }

      // Page Footer Navy Bar
      doc.rect(0, 810, 595.28, 31.89).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica');
      doc.text('Aarna Estates Premium Portfolio Brochure - Confidential Property Document', 40, 822);
      doc.text('Page 2 of 3', 510, 822);

      // ==========================================
      // PAGE 3: NEIGHBORHOOD & CONTACT DETAILS
      // ==========================================
      doc.addPage({ size: 'A4', margin: 0 });

      // White background
      doc.rect(0, 0, 595.28, 841.89).fill('#ffffff');

      // Top navy banner
      doc.rect(0, 0, 595.28, 45).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
      doc.text(property.title.toUpperCase(), 40, 18, { align: 'left' });
      doc.text('NEIGHBORHOOD MAP & CONTACT SHEET', 40, 18, { align: 'right' });

      // Left Column - Neighborhood Highlights (Emoji-Free)
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold');
      doc.text('Location Highlights', 40, 75);
      doc.rect(40, 97, 230, 2).fill('#d97706');

      const rawNearby: string[] = property.nearbyPlaces || [
        'Local Transit Hub Metro (500 meters)',
        'Aarna International School (1.2 km)',
        'Multispecialty Care Hospital (800 meters)',
        'Commercial High Street Market (1.5 km)',
        'International Airport Terminal (12.5 km)'
      ];

      // Sanitize emojis just in case
      const cleanNearby = rawNearby.map(n => n.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim());

      doc.fillColor('#334155').fontSize(9.5).font('Helvetica-Bold').lineGap(2);
      let nbY = 115;
      for (const place of cleanNearby) {
        doc.text(`*  ${place}`, 40, nbY, { width: 230 });
        nbY += 28;
      }

      // Location narrative (Clean)
      doc.fillColor('#475569').fontSize(9.5).font('Helvetica');
      doc.text(
        'The property is strategically located inside a highly developed corridor with immediate access to schools, ' +
        'major hospitals, shopping districts, and highways. High annual rental yields and robust price appreciation ' +
        'are predicted due to upcoming transit investments in this specific zone.',
        40, 280, { width: 230, align: 'justify', lineGap: 3.5 }
      );

      // Right Column - Neighborhood Connectivity Map Drawing (Vector Illustration)
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold');
      doc.text('Area Connectivity Map', 310, 75);
      doc.rect(310, 97, 245, 2).fill('#d97706');

      const mapX = 310;
      const mapY = 110;
      const mapW = 245;
      const mapH = 220;

      // Map canvas background
      doc.rect(mapX, mapY, mapW, mapH).fill('#e0f2fe'); // Light sky blue
      doc.rect(mapX, mapY, mapW, mapH).strokeColor('#bae6fd').lineWidth(1).stroke();

      // Draw Vector roads on Map
      doc.strokeColor('#ffffff').lineWidth(12);
      
      // Main Highway
      doc.moveTo(mapX + 20, mapY).lineTo(mapX + 180, mapY + mapH).stroke();
      
      // Ring Road
      doc.moveTo(mapX, mapY + 120).lineTo(mapX + mapW, mapY + 60).stroke();

      // Highway borders
      doc.strokeColor('#cbd5e1').lineWidth(0.5);
      doc.moveTo(mapX + 14, mapY).lineTo(mapX + 174, mapY + mapH).stroke();
      doc.moveTo(mapX + 26, mapY).lineTo(mapX + 186, mapY + mapH).stroke();

      // Map Landmarks (All emoji-free clean text to avoid garbled symbols)
      doc.fillColor('#ef4444'); // Red Circle representing site
      doc.circle(mapX + 100, mapY + 95, 6).fill();
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold');
      doc.text('THE PROPERTY SITE', mapX + 112, mapY + 92);

      // Metro Station Landmark
      doc.fillColor('#d97706');
      doc.circle(mapX + 40, mapY + 130, 4.5).fill();
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
      doc.text('METRO TRANSIT STATION', mapX + 50, mapY + 128);

      // Care Hospital Landmark
      doc.fillColor('#059669');
      doc.circle(mapX + 180, mapY + 50, 4.5).fill();
      doc.text('CARE HOSPITAL', mapX + 110, mapY + 40);

      // Coordinates
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica');
      doc.text(`Location GPS: Lat: ${property.latitude || 25.594}, Long: ${property.longitude || 85.041}`, 310, 345);

      // Contact & Call to Action Cards (Footer Box)
      doc.rect(40, 440, 515, 230).fill('#f8fafc');
      doc.rect(40, 440, 515, 230).strokeColor('#cbd5e1').lineWidth(1).stroke();

      doc.fillColor('#0f172a').fontSize(15).font('Helvetica-Bold');
      doc.text('Schedule Your Site Visit & Consultation', 60, 460);
      doc.rect(60, 482, 475, 1).fill('#cbd5e1');

      doc.fillColor('#334155').fontSize(10.5).font('Helvetica').lineGap(2);
      doc.text('Interested in this premium property? Contact our elite consulting managers to schedule a guided site tour or request callback support:', 60, 495, { width: 475 });

      // Manager Contact Card
      doc.rect(60, 550, 220, 80).fill('#ffffff');
      doc.rect(60, 550, 220, 80).strokeColor('#e2e8f0').lineWidth(1).stroke();
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
      doc.text('Manager: Ashish Kumar', 75, 565);
      doc.fillColor('#d97706').fontSize(9.5).font('Helvetica-Bold');
      doc.text('Phone: +91 98765 43210', 75, 585);
      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      doc.text('Email: ashish.k@aarnaestates.com', 75, 605);

      // Agency Card
      doc.rect(315, 550, 220, 80).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
      doc.text('Aarna Estates AI Platform', 330, 565);
      doc.fillColor('#d97706').fontSize(9).font('Helvetica-Bold');
      doc.text('24/7 Telegram AI Assistant', 330, 585);
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
      doc.text('Send "/start" to trigger guided property search anytime.', 330, 605, { width: 195 });

      // Page Footer Navy Bar
      doc.rect(0, 810, 595.28, 31.89).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica');
      doc.text('Aarna Estates Premium Portfolio Brochure - Confidential Property Document', 40, 822);
      doc.text('Page 3 of 3', 510, 822);

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
