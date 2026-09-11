import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Builds the OpenAPI document.
 *
 * Extracted from `main.ts` so the served document and the committed snapshot
 * come from **one** definition. Duplicating the DocumentBuilder would let the
 * snapshot drift from what is actually served, which makes the contract gate
 * worse than useless: it would pass while the real API changed.
 *
 * `cleanupOpenApiDoc` is nestjs-zod v5's replacement for the old
 * `patchNestJsSwagger()` monkey-patch — `createZodDto` attaches its own
 * OpenAPI metadata, and this post-processes the finished document to resolve
 * the Zod-generated schemas into proper components.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  return cleanupOpenApiDoc(
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('DJ Felicitous API')
        .setDescription(
          'Content and booking API. Public reads are by slug and cacheable; ' +
            'admin writes are by id and require a bearer token. Errors follow ' +
            'RFC 9457 (application/problem+json).',
        )
        .setVersion('1')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
        .addCookieAuth('dj_rt')
        .addTag('auth', 'Sign in, token rotation and two-factor')
        .addTag('health', 'Liveness and readiness probes')
        .addTag('personas', 'Public persona reads')
        .addTag('admin: personas', 'Persona CMS writes')
        .build(),
    ),
  );
}
