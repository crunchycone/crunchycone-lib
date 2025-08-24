export const mockTransporter = {
  sendMail: jest.fn(),
};

export const createTransport = jest.fn().mockReturnValue(mockTransporter);

export default {
  createTransport,
};