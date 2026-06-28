export function serializeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    employeeId: user.employeeId,
    role: user.role,
    avatarUrl: user.avatarUrl,
    department: user.department,
    position: user.position,
    bio: user.bio,
    points: user.points,
    badges: user.badges,
    monthlyTargetAmount: user.monthlyTargetAmount,
    dailySalesAmount: user.dailySalesAmount,
    monthlySalesAccumulated: user.monthlySalesAccumulated,
    targetPercentage: user.targetPercentage,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
