import axios, { AxiosError } from 'axios';
import { startServer, stopServer } from '../source/server';
import { PrismaClient } from '@prisma/client';

const GUEST_A_UNIT_1 = {
    unitID: '1',
    guestName: 'GuestA',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const GUEST_A_UNIT_2 = {
    unitID: '2',
    guestName: 'GuestA',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const GUEST_B_UNIT_1 = {
    unitID: '1',
    guestName: 'GuestB',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const prisma = new PrismaClient();

beforeEach(async () => {
    // Clear any test setup or state before each test
    await prisma.booking.deleteMany();
});

beforeAll(async () => {
    await startServer();
});

afterAll(async () => {
    await prisma.$disconnect();
    await stopServer();
});

describe('Booking and Extension API', () => {

    test('Create fresh booking', async () => {
        const response = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);

        expect(response.status).toBe(200);
        expect(response.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response.data.booking.unitID).toBe(GUEST_A_UNIT_1.unitID);
        expect(response.data.booking.numberOfNights).toBe(GUEST_A_UNIT_1.numberOfNights);
    });

    test('Same guest same unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.booking.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // Guests want to book the same unit again
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toEqual('The given guest name cannot book the same unit multiple times');
    });

    test('Same guest different unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.booking.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // Guest wants to book another unit
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_2);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toEqual('The same guest cannot be in multiple units at the same time');
    });

    test('Different guest same unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.booking.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // GuestB trying to book a unit that is already occupied
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_B_UNIT_1);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toEqual('For the given dates, the unit is already occupied');
    });

    test('Different guest same unit booking different date', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);

        // GuestB trying to book a unit that is already occupied
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', {
                unitID: '1',
                guestName: 'GuestB',
                checkInDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                numberOfNights: 5
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toEqual('For the given dates, the unit is already occupied');
    });

    // Test Cases for Extension functionality
    test('Extend stay successfully', async () => {
        // Create initial booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);

        // Extend the stay
        const extendResponse = await axios.put('http://localhost:8000/api/v1/booking/extend/', {
            guestName: GUEST_A_UNIT_1.guestName,
            unitID: GUEST_A_UNIT_1.unitID,
            additionalNights: 3
        });

        expect(extendResponse.status).toBe(200);
        expect(extendResponse.data.booking.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(extendResponse.data.booking.unitID).toBe(GUEST_A_UNIT_1.unitID);
        expect(extendResponse.data.booking.numberOfNights).toBe(GUEST_A_UNIT_1.numberOfNights + 3);
    });

    
    test('Try to extend a booking that does not exist', async () => {
        // Try to extend a non-existent booking
        let error: any;
        try {
            await axios.put('http://localhost:8000/api/v1/booking/extend/', {
                guestName: 'NonExistentGuest',
                unitID: '10',
                additionalNights: 3
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toEqual('No booking found for the specified guest and unit');
    });

    
    test('Try to do a booking extension that can conflict with another booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);

        /* 
        Create a conflicting booking that starts after the first booking         
        The First Booking by GuestA is from today's date to 5 days from now.
        The Second Booking from GuestC starts from 6 days from now and is for 5 nights. 
         */
        const conflictingBooking = {
            unitID: '1',
            guestName: 'GuestC',
            checkInDate: new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            numberOfNights: 5
        };
        const response2 = await axios.post('http://localhost:8000/api/v1/booking', conflictingBooking);
        expect(response2.status).toBe(200);

        // Try to extend the first booking to conflict with the second booking
        let error: any;
        try {
            await axios.put('http://localhost:8000/api/v1/booking/extend/', {
                guestName: GUEST_A_UNIT_1.guestName,
                unitID: GUEST_A_UNIT_1.unitID,
                additionalNights: 10
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toEqual('The unit is not available for the requested extension period');
    });
    
});
