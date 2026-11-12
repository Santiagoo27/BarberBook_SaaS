using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberBookSaaS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgregarLoyaltyRewardServiceId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LoyaltyRewardServiceId",
                table: "Tenants",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoyaltyRewardServiceId",
                table: "Tenants");
        }
    }
}
