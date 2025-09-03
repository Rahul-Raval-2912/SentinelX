import CryptoJS from 'crypto-js';

export class E2EECrypto {
  static generateKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  static generateKeyPair() {
    // Simplified - in production use proper ECDH/RSA
    const privateKey = CryptoJS.lib.WordArray.random(256/8).toString();
    const publicKey = CryptoJS.SHA256(privateKey).toString();
    return { privateKey, publicKey };
  }

  static encryptReport(data, key) {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
      mode: CryptoJS.mode.GCM
    });
    return {
      ciphertext: encrypted.toString(),
      iv: encrypted.iv?.toString(),
      salt: encrypted.salt?.toString()
    };
  }

  static decryptReport(encryptedData, key) {
    const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, key, {
      mode: CryptoJS.mode.GCM,
      iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
      salt: CryptoJS.enc.Hex.parse(encryptedData.salt)
    });
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  }

  static wrapKey(symmetricKey, recipientPublicKey) {
    return CryptoJS.AES.encrypt(symmetricKey, recipientPublicKey).toString();
  }

  static unwrapKey(wrappedKey, privateKey) {
    return CryptoJS.AES.decrypt(wrappedKey, privateKey).toString(CryptoJS.enc.Utf8);
  }

  static hashContent(content) {
    return CryptoJS.SHA3(JSON.stringify(content), { outputLength: 256 }).toString();
  }
}