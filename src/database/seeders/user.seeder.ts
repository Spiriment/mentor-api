import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { User } from '@/database/entities/user.entity';
import { encryptionService } from '@/config/int-services';
import { faker } from '@faker-js/faker';
import { ACCOUNT_STATUS, GENDER } from '@/common/constants';

export default class UserSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager
  ): Promise<void> {
    const userRepository = dataSource.getRepository(User);

    const existingUsers = await userRepository.count();
    if (existingUsers > 0) {
      console.log('Users already seeded, skipping...');
      return;
    }

    const hashedPassword = await encryptionService.hash('Password');

    const users = Array.from({ length: 1000 }, () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName });
      const gender = faker.helpers.arrayElement(Object.values(GENDER));

      const shouldHaveReferral = faker.datatype.boolean({ probability: 0.6 });

      return {
        email,
        firstName,
        lastName,
        middleName: faker.datatype.boolean({ probability: 0.3 })
          ? faker.person.middleName()
          : undefined,
        password: hashedPassword,
        gender,
        isActive: faker.datatype.boolean({ probability: 0.9 }),
        accountStatus: faker.helpers.arrayElement(
          Object.values(ACCOUNT_STATUS)
        ),
        isEmailVerified: faker.datatype.boolean({ probability: 0.8 }),
        emailVerifiedAt: faker.datatype.boolean({ probability: 0.8 })
          ? faker.date.past()
          : undefined,
        pushNotificationId: faker.datatype.boolean({ probability: 0.4 })
          ? faker.string.uuid()
          : undefined,
        appVersion: faker.datatype.boolean({ probability: 0.7 })
          ? faker.system.semver()
          : undefined,
        avatar: faker.datatype.boolean({ probability: 0.3 })
          ? {
              url: faker.image.avatar(),
              publicId: faker.string.alphanumeric(10),
            }
          : undefined,
        wallet: faker.datatype.boolean({ probability: 0.5 })
          ? {
              balance: faker.number.float({
                min: 0,
                max: 10000,
                fractionDigits: 2,
              }),
              currency: 'NGN',
            }
          : undefined,

        createdAt: faker.date.past({ years: 1 }),
        updatedAt: faker.date.recent(),
      };
    });

    await userRepository.save(users);
  }
}
