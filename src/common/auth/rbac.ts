export enum RoleEnum {
  USER = "user",
}

export class RBAC {
  static hasPermission(role: RoleEnum, requiredRole: RoleEnum): boolean {
    return role === requiredRole;
  }
}
