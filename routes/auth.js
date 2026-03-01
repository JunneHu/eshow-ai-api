/**
 * 认证相关路由：注册、登录、修改密码
 * 在 app.js 中通过 registerAuth(router, deps) 挂载
 */
function registerAuth(router, deps) {
  const { logger, User, bcrypt, generateToken, authRequired, validate, schemas } = deps;

  // 注册（接入 validation 示例）
  router.post(
    "/api/auth/register",
    validate(schemas.register, { source: "body" }),
    async (ctx) => {
      const { username, password } = ctx.request.body || {};
      try {
        const existed = await User.findOne({ where: { username } });
        if (existed) {
          ctx.status = 400;
          ctx.body = { code: -1, message: "用户名已存在" };
          return;
        }

        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({
          username,
          passwordHash: hash,
        });

        const token = generateToken(user);

        ctx.body = {
          code: 0,
          message: "注册成功",
          data: {
            token,
            user: {
              id: user.id,
              username: user.username,
            },
          },
        };
      } catch (error) {
        logger.error("Register failed", {
          traceId: ctx.state && ctx.state.traceId,
          error: error.message,
        });
        ctx.status = 500;
        ctx.body = { code: -1, message: "注册失败" };
      }
    }
  );

  // 登录
  router.post("/api/auth/login", async (ctx) => {
    const { username, password } = ctx.request.body || {};

    if (!username || !password) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "用户名和密码为必填项" };
      return;
    }

    try {
      const user = await User.findOne({ where: { username } });
      if (!user) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "用户名或密码错误" };
        return;
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "用户名或密码错误" };
        return;
      }

      const token = generateToken(user);
      ctx.body = {
        code: 0,
        message: "登录成功",
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
          },
        },
      };
    } catch (error) {
      logger.error("Login failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "登录失败" };
    }
  });

  // 修改密码（需要登录）
  router.post("/api/auth/change-password", authRequired, async (ctx) => {
    const { oldPassword, newPassword } = ctx.request.body || {};

    if (!oldPassword || !newPassword) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "旧密码和新密码为必填项" };
      return;
    }

    try {
      const user = await User.findByPk(ctx.state.user.id);
      if (!user) {
        ctx.status = 401;
        ctx.body = { code: -1, message: "用户不存在或已被删除" };
        return;
      }

      const ok = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!ok) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "旧密码不正确" };
        return;
      }

      const hash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = hash;
      await user.save();

      ctx.body = { code: 0, message: "密码修改成功" };
    } catch (error) {
      logger.error("Change password failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "修改密码失败" };
    }
  });
}

module.exports = registerAuth;
