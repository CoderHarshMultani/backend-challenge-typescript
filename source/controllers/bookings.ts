import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma'

interface Booking {
    guestName: string;
    unitID: string;
    checkInDate: Date;
    numberOfNights: number;
}

const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({
        message: "OK"
    })
}

const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    const booking: Booking = req.body;

    let outcome = await isBookingPossible(booking);
    if (!outcome.result) {
        return res.status(400).json({
            error: outcome.reason
        });
    }

    let checkInDate = new Date(booking.checkInDate);
    let checkOutDate = new Date(checkInDate.getTime() + booking.numberOfNights * 24 * 60 * 60 * 1000);

    let bookingResult = await prisma.booking.create({
        data: {
             guestName: booking.guestName,
             unitID: booking.unitID,
             checkInDate: checkInDate,
             checkOutDate: checkOutDate,
             numberOfNights: booking.numberOfNights
       }
    })

    return res.status(200).json({
        message: "Booking created successfully",
        booking: bookingResult
    });
}

type bookingOutcome = {result:boolean, reason:string};

async function isBookingPossible(booking: Booking): Promise<bookingOutcome> {
    // check 1 : The Same guest cannot book the same unit multiple times
    let sameGuestSameUnit = await prisma.booking.findMany({
        where: {
            AND: {
                guestName: {
                    equals: booking.guestName,
                },
                unitID: {
                    equals: booking.unitID,
                },
            },
        },
    });
    if (sameGuestSameUnit.length > 0) {
        return {result: false, reason: "The given guest name cannot book the same unit multiple times"};
    }

    // check 2 : the same guest cannot be in multiple units at the same time
    let sameGuestAlreadyBooked = await prisma.booking.findMany({
        where: {
            guestName: {
                equals: booking.guestName,
            },
        },
    });
    if (sameGuestAlreadyBooked.length > 0) {
        return {result: false, reason: "The same guest cannot be in multiple units at the same time"};
    }

    
    /*
    OPTIMIZED VERSION OF CHECK 2 :
    This can be the optimized version of check 2.
    Currently, the guest is allowed to perform only one booking.
    Through this, The guest will be able to book different units and at different time durations.
    */
    /*
    let newCheckInDate = new Date(booking.checkInDate);
    let newCheckOutDate = new Date(newCheckInDate.getTime() + booking.numberOfNights * 24 * 60 * 60 * 1000);    
    for (const bookingOfSameGuest of sameGuestAlreadyBooked) {

        if(newCheckInDate < bookingOfSameGuest.checkOutDate)
        {
            if(newCheckOutDate > bookingOfSameGuest.checkInDate)
            {
                return {result: false, reason: "The same guest cannot be in multiple units at the same time"};
            }
        }
    }
    */


    // check 3 : Unit is available for the check-in date    
    let newBookingCheckInDate = new Date(booking.checkInDate);
    let newBookingCheckOutDate = new Date(newBookingCheckInDate.getTime() + booking.numberOfNights * 24 * 60 * 60 * 1000);
    
    let existingBookingsForUnit = await prisma.booking.findMany({
        where: {
            unitID: {
                equals: booking.unitID,
            },
        },
    });

    for (const existingBooking of existingBookingsForUnit) {

        let existingBookingCheckInDate = new Date(existingBooking.checkInDate);
        let existingBookingCheckOutDate = new Date(existingBooking.checkOutDate);
        
        /*
        I identified 12 scenarios that can occur while booking a unit.
        The following if statements returns an error message during the 8 failing cases.
        */
        if(newBookingCheckInDate < existingBookingCheckOutDate)
            {
                if(newBookingCheckOutDate > existingBookingCheckInDate)
                {
                    return {result: false, reason: "For the given dates, the unit is already occupied"};
                }
            }
    } 

    return {result: true, reason: "OK"};
}

// Functionality to Extend the stay of a guest in a particular unit
const extendStay = async (req: Request, res: Response, next: NextFunction) => {
    
    const { guestName, unitID, additionalNights } = req.body;

    let existingBooking = await prisma.booking.findFirst({
        where: {
            guestName: guestName,
            unitID: unitID,
        }
    });

    if (!existingBooking) {
        return res.status(404).json({
            error: "No booking found for the specified guest and unit"
        });
    }

    let extensionOutcome = await isExtensionPossible(existingBooking, additionalNights);
    if (!extensionOutcome.result) {
        return res.status(400).json({
            error: extensionOutcome.reason
        });
    }

    let newCheckOutDate = new Date(existingBooking.checkOutDate.getTime() + additionalNights * 24 * 60 * 60 * 1000);
    let newNumberOfNights = existingBooking.numberOfNights + additionalNights;

    let updatedBooking = await prisma.booking.update({
        where: {
            id: existingBooking.id
        },
        data: {
            checkOutDate: newCheckOutDate,
            numberOfNights: newNumberOfNights
        }
    });

    return res.status(200).json({
        message: "Stay extended successfully",
        booking: updatedBooking
    });

}

type extensionOutcome = {result: boolean, reason: string};

async function isExtensionPossible(existingBooking: any, additionalNights: number): Promise<extensionOutcome> {
    
    let newCheckOutDate = new Date(existingBooking.checkOutDate.getTime() + additionalNights * 24 * 60 * 60 * 1000);

    let existingBookingsForUnit = await prisma.booking.findMany({
        where: {
            unitID: {
                equals: existingBooking.unitID,
            },
        },
    });

    for (const booking of existingBookingsForUnit) {

        // Skip the current booking
        if (booking.id == existingBooking.id) {
            continue;
        }

        let bookingCheckInDate = new Date(booking.checkInDate);

        /*
        I identified 6 scenarios that can occur while extending a booking.
        The following if statements returns an error message during the 2 failing cases.
        */
        if(existingBooking.checkInDate < bookingCheckInDate)
        {
            if(newCheckOutDate > bookingCheckInDate)
            {
                return {result: false, reason: "The unit is not available for the requested extension period"};
            }
        }
    }

    return {
        result: true,
        reason: "Extension is possible"
    };
}

export default { healthCheck, createBooking, extendStay }
