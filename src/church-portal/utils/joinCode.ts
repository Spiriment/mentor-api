import crypto from 'crypto';
import { Repository } from 'typeorm';
import { ChurchPortal } from '../entities/churchPortal.entity';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomJoinCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let j = 0; j < 8; j++) {
    code += CODE_CHARS[bytes[j] % CODE_CHARS.length];
  }
  return code;
}

export async function generateUniqueJoinCode(repo: Repository<ChurchPortal>): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = randomJoinCode();
    const exists = await repo.exist({ where: { joinCode: code } });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique church join code');
}
